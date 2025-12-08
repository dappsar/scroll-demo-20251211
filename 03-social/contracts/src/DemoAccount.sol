// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC1271} from "@openzeppelin/contracts/interfaces/IERC1271.sol";
import {SignatureChecker} from "@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol";
import "./AASimpleTypes.sol";

/**
 * @dev Minimal ERC-4337 compatible smart account for demo purposes.
 *      Uses SimpleUserOperation and ISimpleEntryPoint to avoid clashes
 *      with the official AA library types.
 */
contract DemoAccount is IERC1271 {
    address public owner;
    address public factoryAdmin; // <── NEW: allows recovery
    ISimpleEntryPoint public immutable entryPoint;
    uint256 public nonce;
    bool public initialized;

    event Executed(address target, uint256 value, bytes data);

    /**
     * @notice Constructor ONLY sets the entryPoint.
     * @dev Owner is NOT set here because CREATE2 address must NOT depend on owner.
     */
    constructor(address _entryPoint) {
        entryPoint = ISimpleEntryPoint(_entryPoint);
    }

    /**
     * @notice Initializes smart account owner once after CREATE2 deployment.
     * @dev Called exclusively by the factory. Prevents reinitialization.
     *
     * @param _owner        Initial owner
     * @param _factoryAdmin Address allowed to perform recovery
     */
    function init(address _owner, address _factoryAdmin) external {
        require(!initialized, "Already initialized");
        initialized = true;
        owner = _owner;
        factoryAdmin = _factoryAdmin;
    }

    /**
     * @notice Allows owner rotation for recovery.
     * @dev Can be called by:
     *      - current owner (normal operation)
     *      - factoryAdmin (recovery if user loses keys)
     */
    function setOwner(address newOwner) external {
        require(msg.sender == owner || msg.sender == factoryAdmin, "Not authorized");
        owner = newOwner;
    }

    function execute(address target, uint256 value, bytes calldata data) external {
        require(msg.sender == address(entryPoint), "Only EntryPoint");

        (bool ok,) = target.call{value: value}(data);
        require(ok, "Execution failed");

        emit Executed(target, value, data);
    }

    /**
     * @notice Called by EntryPoint during validation.
     * @param userOp      Struct with AA data (sender, callData, gas, etc.).
     * @param userOpHash  Hash computed by EntryPoint (struct-hash + domain).
     * @dev Frontend signs `userOpHash` using viem's signMessage({ raw: userOpHash }),
     *      which applies the standard EIP-191 prefix:
     *      keccak256("\x19Ethereum Signed Message:\n32" ++ userOpHash)
     *      so we must reconstruct that hash here before verifying.
     */
    function validateUserOp(SimpleUserOperation calldata userOp, bytes32 userOpHash, uint256 /* missingFunds */ )
        external
        returns (uint256)
    {
        require(msg.sender == address(entryPoint), "Only EntryPoint");

        // Rebuild the same hash that viem.signMessage() used for (raw userOpHash).
        bytes32 ethSignedHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", userOpHash));

        bool valid = SignatureChecker.isValidSignatureNow(owner, ethSignedHash, userOp.signature);
        require(valid, "Invalid signature");

        require(userOp.nonce == nonce, "Bad nonce");
        nonce++;

        return 0; // success
    }

    /**
     * @dev EIP-1271 signature validation hook.
     *
     * This function allows external callers (including the EntryPoint)
     * to ask the contract whether a given signature is valid for a given hash.
     *
     * IMPORTANT:
     * - The contract does NOT compute or reconstruct the hash.
     *   The caller must supply the exact digest that was signed off-chain.
     * - If the frontend signs using `signMessage({ raw: hash })`,
     *   then `hash` must be that exact 32-byte digest.
     * - If the frontend uses Ethereum's prefixed message signing
     *   ("\x19Ethereum Signed Message:\n32" || hash), you must apply the same
     *   prefixing here before validating, otherwise signatures will not match.
     *
     * Under the hood, SignatureChecker will:
     * - For EOAs: recover the signer via ECDSA and compare with `owner`.
     * - For contract owners: call their own EIP-1271 implementation.
     *
     * Returns:
     * - `0x1626ba7e` (EIP-1271 magic value) if signature is valid.
     * - `0xffffffff` if signature is invalid.
     */
    function isValidSignature(bytes32 hash, bytes calldata signature) external view override returns (bytes4) {
        // Performs ECDSA or contract-based signature verification depending on `owner` type.
        bool valid = SignatureChecker.isValidSignatureNow(owner, hash, signature);

        // EIP-1271 required return format.
        return valid ? IERC1271.isValidSignature.selector : bytes4(0xffffffff);
    }

    receive() external payable {}
}
