// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IEntryPoint} from "lib/account-abstraction/contracts/interfaces/IEntryPoint.sol";
import {IPaymaster, UserOperation} from "lib/account-abstraction/contracts/interfaces/IPaymaster.sol";

/**
 * @title DemoPaymaster
 * @notice Minimal ERC-4337 Paymaster example.
 *         This paymaster accepts a user operation only if a valid
 *         offchain signature from `signer` is included in paymasterAndData.
 *         It sponsors gas fees by using its deposit in the EntryPoint.
 */
contract DemoPaymaster is IPaymaster {
    IEntryPoint public immutable entryPoint;
    address public owner;
    address public signer;

    // Used only to silence the Solidity warning that postOp could be view.
    uint256 internal dummyCounter;

    /**
     * @param _entryPoint Address of the EntryPoint (v0.6).
     * @param _signer Address allowed to sign valid paymasterAndData payloads.
     */
    constructor(address _entryPoint, address _signer) {
        entryPoint = IEntryPoint(_entryPoint);
        owner = msg.sender;
        signer = _signer;
    }

    /**
     * @notice Allows the contract to receive ETH payments
     * @dev Implements the receive function to accept ETH transfers
     */
    receive() external payable {}

    /**
     * @notice Ensures that only the contract owner can call the function
     * @dev Reverts if the caller is not the contract owner
     */
    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }

    /* -------------------------------------------------------------------------- */
    /*                      PAYMASTER VALIDATION (EntryPoint)                     */
    /* -------------------------------------------------------------------------- */

    /**
     * @notice Validates a UserOperation for the Paymaster
     * @dev Ensures the operation is properly signed and returns validationData with expiration time
     * @param userOp The UserOperation struct containing operation details
     * @return context Additional context for the operation (empty in this case)
     * @return validationData A packed value containing validation status and expiration time
     */
    function validatePaymasterUserOp(UserOperation calldata userOp, bytes32, uint256)
        external
        view
        override
        returns (bytes memory context, uint256 validationData)
    {
        require(msg.sender == address(entryPoint), "only entrypoint");

        // paymasterAndData = address(this) (20 bytes) + signature
        bytes calldata pnd = userOp.paymasterAndData;
        require(pnd.length == 20 + 65, "invalid paymasterAndData length");
        bytes calldata signature = pnd[20:85];

        bytes32 h = keccak256(abi.encodePacked(userOp.sender, userOp.callData, userOp.nonce));

        address recovered = _recover(h, signature);
        require(recovered == signer, "invalid paymaster signature");

        return ("", 0);
    }

    /* -------------------------------------------------------------------------- */
    /*                                POST-OP LOGIC                               */
    /* -------------------------------------------------------------------------- */

    /**
     * @notice Called after the userOp execution.
     *         Even if unused, it MUST exist to comply with IPaymaster.
     *
     * @dev We increment dummyCounter to avoid the compiler warning
     *      that suggests making this function view.
     */
    function postOp(PostOpMode, bytes calldata, uint256) external override {
        require(msg.sender == address(entryPoint), "only entrypoint");
        dummyCounter++; // meaningless write to silence warnings
    }

    /* -------------------------------------------------------------------------- */
    /*                                 SIGNATURES                                 */
    /* -------------------------------------------------------------------------- */

    /**
     * @notice Recovers the signer of the given signature.
     * @param digest Hash over the data being validated.
     * @param sig Signature appended in paymasterAndData.
     */
    function _recover(bytes32 digest, bytes calldata sig) internal pure returns (address) {
        bytes32 ethHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", digest));

        (uint8 v, bytes32 r, bytes32 s) = _split(sig);
        return ecrecover(ethHash, v, r, s);
    }

    /**
     * @notice Splits a 65-byte signature into (v, r, s).
     */
    function _split(bytes calldata sig) internal pure returns (uint8, bytes32, bytes32) {
        require(sig.length == 65, "invalid signature length");

        bytes32 r;
        bytes32 s;
        uint8 v;

        assembly {
            r := calldataload(sig.offset)
            s := calldataload(add(sig.offset, 32))
            v := byte(0, calldataload(add(sig.offset, 64)))
        }

        return (v, r, s);
    }

    /* -------------------------------------------------------------------------- */
    /*                          ADMIN AND ENTRYPOINT OPS                           */
    /* -------------------------------------------------------------------------- */

    /**
     * @notice Return current paymaster's deposit on the entryPoint.
     */
    function getDeposit() public view returns (uint256) {
        return entryPoint.balanceOf(address(this));
    }

    /**
     * @notice Sends ETH from msg.value to the paymaster deposit in EntryPoint.
     */
    function deposit() external payable {
        entryPoint.depositTo{value: msg.value}(address(this));
    }

    /**
     * @notice Adds stake to the paymaster in the EntryPoint.
     * @param unstakeDelaySec Delay before stake can be withdrawn.
     */
    function addStake(uint32 unstakeDelaySec) external payable onlyOwner {
        entryPoint.addStake{value: msg.value}(unstakeDelaySec);
    }

    /**
     * @notice Unlocks the paymaster stake in EntryPoint.
     */
    function unlockStake() external onlyOwner {
        entryPoint.unlockStake();
    }

    /**
     * @notice Withdraws previously unlocked stake.
     */
    function withdrawStake(address payable to) external onlyOwner {
        entryPoint.withdrawStake(to);
    }

    /**
     * @notice Withdraws deposited ETH from EntryPoint to a target address.
     */
    function withdraw(address to) external onlyOwner {
        uint256 amount = address(this).balance;

        (bool success,) = payable(to).call{value: amount}("");
        require(success, "Withdraw failed");
    }
}
