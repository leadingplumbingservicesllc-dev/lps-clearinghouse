// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC4626} from "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {SignatureChecker} from "@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol";

/// @notice Illiquid receivable NAV includes outstanding principal; deposits and redemptions are paused during impairment assessment.
contract LienLiquidityVault is ERC4626, AccessControl, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    bytes32 public constant CLEARING_ROLE = keccak256("CLEARING_ROLE");
    uint256 public outstanding;
    event PrincipalWrittenOff(uint256 amount, bytes32 evidenceHash);
    constructor(IERC20 usdc, address admin) ERC4626(usdc) ERC20("LPS Lien Liquidity", "lpUSDC") {
        require(admin != address(0) && IERC20Metadata(address(usdc)).decimals() == 6, "USDC/admin");
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }
    function totalAssets() public view override returns (uint256) { return IERC20(asset()).balanceOf(address(this)) + outstanding; }
    function maxDeposit(address) public view override returns (uint256) { return paused() ? 0 : type(uint256).max; }
    function maxMint(address) public view override returns (uint256) { return paused() ? 0 : type(uint256).max; }
    function maxWithdraw(address owner) public view override returns (uint256) { return paused() ? 0 : _min(super.maxWithdraw(owner), IERC20(asset()).balanceOf(address(this))); }
    function maxRedeem(address owner) public view override returns (uint256) { return paused() ? 0 : _min(super.maxRedeem(owner), convertToShares(IERC20(asset()).balanceOf(address(this)))); }
    function _min(uint256 a, uint256 b) private pure returns (uint256) {return a < b ? a : b;}
    function _deposit(address caller,address receiver,uint256 assets,uint256 shares) internal override nonReentrant whenNotPaused {super._deposit(caller,receiver,assets,shares);}
    function _withdraw(address caller,address receiver,address owner,uint256 assets,uint256 shares) internal override nonReentrant whenNotPaused {super._withdraw(caller,receiver,owner,assets,shares);}
    function advance(address contractor,uint256 amount) external onlyRole(CLEARING_ROLE) nonReentrant whenNotPaused {
        require(contractor != address(0) && amount > 0, "Invalid advance");
        outstanding += amount;
        IERC20(asset()).safeTransfer(contractor, amount);
    }
    function collect(address payer,uint256 principal,uint256 payment) external onlyRole(CLEARING_ROLE) nonReentrant {
        require(payment >= principal && outstanding >= principal, "Invalid settlement");
        outstanding -= principal;
        IERC20(asset()).safeTransferFrom(payer,address(this),payment);
    }
    function recognizeLoss(uint256 principal, bytes32 evidenceHash) external onlyRole(CLEARING_ROLE) whenPaused {
        require(principal > 0 && principal <= outstanding && evidenceHash != bytes32(0), "Invalid loss");
        outstanding -= principal; emit PrincipalWrittenOff(principal,evidenceHash);
    }
    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {_pause();}
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {_unpause();}
}

/// @notice A token is an operational record, not a legally recorded lien assignment or satisfaction.
contract MechanicsLienClearing is ERC721, AccessControl, Pausable, ReentrancyGuard, EIP712 {
    bytes32 public constant UNDERWRITER_ROLE = keccak256("UNDERWRITER_ROLE");
    bytes32 public constant RESOLVER_ROLE = keccak256("RESOLVER_ROLE");
    bytes32 public constant ASSIGNMENT_TYPEHASH = keccak256("Assignment(uint256 tokenId,bytes32 termsHash,uint256 advance,uint256 deadline)");
    enum State { Verified, Funded, Resolved, WrittenOff }
    struct Claim {string county; string instrument; string parcel; uint256 faceValue; uint256 advance; address contractor; bytes32 termsHash; State state;}
    LienLiquidityVault public immutable vault;
    uint256 public nextId;
    mapping(uint256 => Claim) public claims;
    mapping(bytes32 => bool) public recorded;
    event ClaimVerified(uint256 indexed tokenId, bytes32 indexed recordKey, bytes32 termsHash);
    event Funded(uint256 indexed tokenId, address indexed contractor, uint256 advance);
    event Resolved(uint256 indexed tokenId, uint256 payment);
    event WrittenOff(uint256 indexed tokenId, bytes32 evidenceHash);
    constructor(LienLiquidityVault vault_,address admin) ERC721("Verified Mechanics Lien","LPSLIEN") EIP712("LPS Mechanics Lien Assignment","1") {
        require(address(vault_) != address(0) && admin != address(0),"Invalid configuration");vault=vault_;_grantRole(DEFAULT_ADMIN_ROLE,admin);
    }
    function verifyClaim(string calldata county,string calldata instrument,string calldata parcel,uint256 faceValue,address contractor,bytes32 termsHash) external onlyRole(UNDERWRITER_ROLE) whenNotPaused returns(uint256 id) {
        require(bytes(county).length>0 && bytes(instrument).length>0 && bytes(parcel).length>0 && faceValue>=100 && contractor!=address(0) && termsHash!=bytes32(0),"Invalid claim");
        bytes32 key=keccak256(abi.encode(county,instrument));require(!recorded[key],"Duplicate claim");recorded[key]=true;id=++nextId;
        uint256 advance=faceValue*93/100;
        claims[id]=Claim(county,instrument,parcel,faceValue,advance,contractor,termsHash,State.Verified);
        _mint(address(this),id);emit ClaimVerified(id,key,termsHash);
    }
    function fund(uint256 id,uint256 deadline,bytes calldata signature) external nonReentrant whenNotPaused {
        Claim storage c=claims[id];require(_ownerOf(id)!=address(0) && c.state==State.Verified && block.timestamp<=deadline,"Not fundable");
        bytes32 hash=_hashTypedDataV4(keccak256(abi.encode(ASSIGNMENT_TYPEHASH,id,c.termsHash,c.advance,deadline)));
        require(SignatureChecker.isValidSignatureNow(c.contractor,hash,signature),"Invalid assignment signature");
        c.state=State.Funded;vault.advance(c.contractor,c.advance);emit Funded(id,c.contractor,c.advance);
    }
    /// @dev Payer approves the vault, not this ERC721. Full face value pays principal and spread into LP NAV.
    function resolve(uint256 id) external nonReentrant {
        Claim storage c=claims[id];require(c.state==State.Funded,"Not funded");c.state=State.Resolved;
        vault.collect(msg.sender,c.advance,c.faceValue);_burn(id);emit Resolved(id,c.faceValue);
    }
    function writeOff(uint256 id,bytes32 evidenceHash) external onlyRole(RESOLVER_ROLE) nonReentrant whenPaused {
        Claim storage c=claims[id];require(c.state==State.Funded,"Not funded");c.state=State.WrittenOff;vault.recognizeLoss(c.advance,evidenceHash);_burn(id);emit WrittenOff(id,evidenceHash);
    }
    function _update(address to,uint256 tokenId,address auth) internal override returns(address) {require(_ownerOf(tokenId)==address(0)||to==address(0),"Non-transferable claim");return super._update(to,tokenId,auth);}
    function supportsInterface(bytes4 id) public view override(ERC721,AccessControl) returns(bool){return super.supportsInterface(id);}
    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {_pause();}
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {_unpause();}
}
