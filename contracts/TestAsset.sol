// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
/// @dev Test-only ERC20; never used by deployment scripts or application.
contract TestAsset is ERC20 {
    constructor() ERC20("Test USD", "TUSD") {_mint(msg.sender,1_000_000*1e6);}
    function decimals() public pure override returns(uint8){return 6;}
}
