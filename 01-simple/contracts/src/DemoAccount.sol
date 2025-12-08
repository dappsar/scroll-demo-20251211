// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IEntryPoint} from "lib/account-abstraction/contracts/interfaces/IEntryPoint.sol";
import {UserOperation} from "lib/account-abstraction/contracts/interfaces/UserOperation.sol";

contract DemoAccount {
    address public owner;
    IEntryPoint public immutable entryPoint;

    constructor(address _owner, address _entryPoint) {
        owner = _owner;
        entryPoint = IEntryPoint(_entryPoint);
    }

    /// @dev Allow the account to receive native tokens to fund prefunds.
    receive() external payable {}

    /// @dev Restricts a function so that it can only be called
    ///      by the configured EntryPoint contract.
    modifier onlyEntryPoint() {
        require(msg.sender == address(entryPoint), "not from entrypoint");
        _;
    }

    /// @notice ERC-4337-style validation hook called by the EntryPoint.
    /// @param userOp The user operation being validated.
    /// @param //*userOpHash*// The hash of the user operation (unused in this minimal example).
    /// @param missingAccountFunds The amount of prefund required by the EntryPoint.
    /// @return validationData 0 on success, non-zero on signature/validation failure.
    function validateUserOp(UserOperation calldata userOp, bytes32, uint256 missingAccountFunds)
        external
        returns (uint256)
    {
        require(msg.sender == address(entryPoint), "not from entrypoint");

        bytes32 hash = keccak256(abi.encodePacked(userOp.sender, userOp.nonce, keccak256(userOp.callData)));

        address recovered = recover(hash, userOp.signature);
        require(recovered == owner, "invalid signature");

        _payPrefund(missingAccountFunds);

        return 0; // OK
    }

    /// @dev Pays the required prefund to the EntryPoint so that it can cover
    ///      gas costs for this UserOperation. The EntryPoint charges fees
    ///      from the account's deposit; here we top up that deposit with
    ///      `missingAccountFunds` when it is non-zero.
    function _payPrefund(uint256 missingAccountFunds) internal {
        if (missingAccountFunds != 0) {
            entryPoint.depositTo{value: missingAccountFunds}(address(this));
        }
    }

    /// @dev Basic execute function that lets the EntryPoint (or the owner)
    /// trigger arbitrary calls from this account.
    function execute(address target, uint256 value, bytes calldata data) external {
        require(msg.sender == address(entryPoint), "only EP");
        (bool ok,) = target.call{value: value}(data);
        require(ok, "exec failed");
    }

    /// @dev Simple helper to expose the EntryPoint address (optional, but handy for tools).
    function getEntryPoint() external view returns (IEntryPoint) {
        return entryPoint;
    }

    /// @dev Optional: change owner (only for demo purposes).
    function setOwner(address newOwner) external {
        require(msg.sender == owner, "not owner");
        owner = newOwner;
    }

    // ECDSA
    function recover(bytes32 digest, bytes memory sig) internal pure returns (address) {
        bytes32 ethHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", digest));
        (uint8 v, bytes32 r, bytes32 s) = split(sig);
        return ecrecover(ethHash, v, r, s);
    }

    function split(bytes memory sig) internal pure returns (uint8, bytes32, bytes32) {
        require(sig.length == 65, "bad sig");
        bytes32 r;
        bytes32 s;
        uint8 v;

        assembly {
            r := mload(add(sig, 32))
            s := mload(add(sig, 64))
            v := byte(0, mload(add(sig, 96)))
        }
        return (v, r, s);
    }
}
