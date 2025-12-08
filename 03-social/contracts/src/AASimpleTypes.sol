// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @dev Local AA types with different names to avoid clashing
 *      with the official account-abstraction library.
 *      Struct layout matches ERC-4337 UserOperation.
 */
struct SimpleUserOperation {
    address sender;
    uint256 nonce;
    bytes initCode;
    bytes callData;
    uint256 callGasLimit;
    uint256 verificationGasLimit;
    uint256 preVerificationGas;
    uint256 maxFeePerGas;
    uint256 maxPriorityFeePerGas;
    bytes paymasterAndData;
    bytes signature;
}

/**
 * @dev Minimal EntryPoint interface using SimpleUserOperation.
 *      ABI is compatible with the real EntryPoint (same layout).
 */
interface ISimpleEntryPoint {
    function getUserOpHash(SimpleUserOperation calldata userOp) external view returns (bytes32);
}
