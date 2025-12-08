// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/DemoLogic.sol";
import "../src/DemoPaymaster.sol";
import "../src/AccountFactory.sol";

contract Deploy is Script {
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(pk);

        address paymasterSigner = vm.addr(pk);
        address entrypoint = 0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789;

        DemoLogic logic = new DemoLogic();
        AccountFactory factory = new AccountFactory();
        DemoPaymaster paymaster = new DemoPaymaster(entrypoint, paymasterSigner);

        vm.stopBroadcast();

        console.log("---------------------------------------");
        console.log("Deployment Results");
        console.log("---------------------------------------");
        console.log("DemoLogic deployed at:      %s", address(logic));
        console.log("AccountFactory deployed at: %s", address(factory));
        console.log("DemoPaymaster deployed at:  %s", address(paymaster));
        console.log("---------------------------------------");
        console.log("Paymaster signer (EOA):     %s", paymasterSigner);
        console.log("---------------------------------------");
    }
}
