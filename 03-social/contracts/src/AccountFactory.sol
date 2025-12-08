// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./DemoAccount.sol";

/**
 * @title AccountFactory
 * @dev CREATE2-based factory for DemoAccount used in AA demos (e.g. social login).
 *
 * ## What this factory gives you
 * - Deploys DemoAccount using CREATE2, so the smart account address is
 *   deterministic and can be computed off-chain.
 * - Determinism is a function of:
 *     - this factory address
 *     - (uuidString, backendSalt) → combined into a salt
 *     - DemoAccount bytecode + constructor args (entryPoint)
 * - Allows an admin to later change the owner of a deployed smart account
 *   for recovery purposes (centralized recovery).
 *
 * ## Deterministic address & AA
 * - The address returned by `getAddress()` is exactly the same address
 *   where `createAccount()` will deploy the DemoAccount via CREATE2.
 * - This is useful in AA flows where:
 *     - The client can know the smart account address before deployment.
 *     - The first UserOperation can include `initCode` that calls `createAccount()`.
 *     - Funds can be sent to the smart account address before it exists on-chain.
 *
 * ## Security notes (demo only)
 * - The salt is derived from (uuidString, backendSalt). If both are guessable,
 *   anyone could call `createAccount()` first and choose a malicious `initialOwner`.
 * - In this demo we assume:
 *     - `backendSalt` is controlled and kept secret by the backend.
 *     - The backend / admin are trusted.
 * - In production you would typically:
 *     - Tie ownership to a verifiable identity (e.g. OAuth proof, signatures),
 *       not blindly trust the `initialOwner` param.
 *     - Carefully design who can recover / rotate owners and how.
 */
contract AccountFactory {
    /// @notice Admin allowed to perform owner recovery on smart accounts.
    address public admin;

    /// @notice Emitted whenever a new DemoAccount is deployed via CREATE2.
    event AccountDeployed(address indexed account, string uuidString);

    /// @notice Emitted whenever the owner of a smart account is changed by admin.
    event SmartAccountOwnerChanged(address indexed account, address newOwner);

    /**
     * @dev Sets the factory admin to the deployer.
     * In this demo, admin is a single address; in production this could be a multisig
     * or a governance-controlled contract.
     */
    constructor() {
        admin = msg.sender;
    }

    /**
     * @dev Restricts certain operations to the factory admin.
     */
    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin");
        _;
    }

    /**
     * @notice Deploy a DemoAccount with a deterministic address, or return it if already deployed.
     *
     * @dev
     * - Deterministic address is derived via CREATE2 using:
     *     salt = keccak256(abi.encodePacked(uuidString, backendSalt))
     *     bytecode = DemoAccount.creationCode + abi.encode(entryPoint)
     *
     * - Flow:
     *     1) Compute salt from (uuidString, backendSalt).
     *     2) Compute predicted address via the same formula as CREATE2 (`getAddress`).
     *     3) If code already exists at `predicted`, return it (idempotent deployment).
     *     4) Otherwise, deploy via CREATE2 and call `init(initialOwner, admin)`.
     *
     * - This pattern is useful for AA + social login:
     *     - The client can call `getAddress()` off-chain to know the smart account address.
     *     - The first UserOperation can include `initCode` that triggers this function.
     *     - If called twice with the same parameters, it won't deploy twice.
     *
     * @param uuidString      User identifier (e.g. derived from OAuth `sub` or app-level UUID).
     * @param backendSalt     Backend-controlled salt to avoid trivial front-running / collisions.
     * @param entryPoint      ERC-4337 EntryPoint that the DemoAccount will be wired to.
     * @param initialOwner    First owner of the DemoAccount (used by `validateUserOp`).
     *
     * @return account        The deployed (or existing) DemoAccount address.
     *
     * @notice SECURITY (DEMO-ONLY WARNING):
     * - If an attacker knows uuidString + backendSalt + entryPoint and can call this function
     *   before the backend, they could deploy a DemoAccount with an arbitrary `initialOwner`.
     * - In production, you would typically:
     *     - Derive the owner from a verified claim (signature, OAuth proof, etc.).
     *     - Or require some backend-signed authorization to bind the account to a user.
     */
    function createAccount(string memory uuidString, bytes32 backendSalt, address entryPoint, address initialOwner)
        external
        returns (address payable account)
    {
        bytes32 salt = keccak256(abi.encodePacked(uuidString, backendSalt));

        // Predicted address based on CREATE2 formula.
        address payable predicted = getAddress(uuidString, backendSalt, entryPoint);

        // Idempotent behavior: if already deployed, just return the existing account.
        if (predicted.code.length > 0) {
            return predicted;
        }

        // Bytecode = DemoAccount creation code + constructor args (entryPoint).
        bytes memory bytecode = abi.encodePacked(type(DemoAccount).creationCode, abi.encode(entryPoint));

        // Low-level CREATE2; deploys the DemoAccount at the deterministic address.
        assembly {
            account := create2(0, add(bytecode, 0x20), mload(bytecode), salt)
        }

        require(account != address(0), "CREATE2 failed");

        // Initialize DemoAccount with initial owner and factory admin (for recovery).
        DemoAccount(account).init(initialOwner, admin);

        emit AccountDeployed(account, uuidString);
    }

    /**
     * @notice Compute the deterministic address of a DemoAccount for given parameters.
     *
     * @dev
     * - This function replicates the CREATE2 address calculation used in `createAccount`.
     * - The formula is:
     *
     *   address = last_20_bytes(
     *       keccak256(
     *           0xff ++ factory_address ++ salt ++ keccak256(bytecode)
     *       )
     *   )
     *
     *   where:
     *     - salt = keccak256(abi.encodePacked(uuidString, backendSalt))
     *     - bytecode = DemoAccount.creationCode ++ abi.encode(entryPoint)
     *
     * - Can be called:
     *     - Off-chain by the client to know the user's smart account address before deployment.
     *     - On-chain by other contracts that need to reference the smart account.
     *
     * @param uuidString      User identifier used in salt derivation.
     * @param backendSalt     Backend-controlled salt used in salt derivation.
     * @param entryPoint      EntryPoint the DemoAccount will be bound to.
     *
     * @return                Predicted DemoAccount address for these parameters.
     */
    function getAddress(string memory uuidString, bytes32 backendSalt, address entryPoint)
        public
        view
        returns (address payable)
    {
        bytes32 salt = keccak256(abi.encodePacked(uuidString, backendSalt));

        bytes memory bytecode = abi.encodePacked(type(DemoAccount).creationCode, abi.encode(entryPoint));

        bytes32 hash = keccak256(abi.encodePacked(bytes1(0xff), address(this), salt, keccak256(bytecode)));

        return payable(address(uint160(uint256(hash))));
    }

    /**
     * @notice Recovery hook: change the owner of a deployed smart account.
     *
     * @dev
     * - Only the factory `admin` can call this function.
     * - It computes the account address via `getAddress`, checks that code exists,
     *   and then calls `setOwner(newOwner)` on the DemoAccount.
     *
     * - This is intended for **demo / workshop** purposes to showcase
     *   recovery / owner rotation via a trusted entity.
     *
     * @param uuidString      Same identifier used when creating the account.
     * @param backendSalt     Same backend salt used when creating the account.
     * @param entryPoint      EntryPoint used to derive the account address.
     * @param newOwner        New EOA that will control the smart account.
     *
     * @notice TRADE-OFF:
     * - Centralized recovery: admin can seize or rotate ownership.
     * - In real-world deployments, this should be:
     *     - Controlled by a multisig, DAO, or recovery policy.
     *     - Clearly communicated to users (who can recover / under what rules).
     */
    function setSmartAccountOwner(string memory uuidString, bytes32 backendSalt, address entryPoint, address newOwner)
        external
        onlyAdmin
    {
        address payable account = getAddress(uuidString, backendSalt, entryPoint);
        require(account.code.length > 0, "Account not deployed");

        DemoAccount(account).setOwner(newOwner);

        emit SmartAccountOwnerChanged(account, newOwner);
    }
}
