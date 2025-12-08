// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/DemoAccount.sol";
import "../src/DemoLogic.sol";

contract Deploy is Script {
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");

        address owner = vm.addr(pk);
        address entrypoint = 0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789; // Scroll Entrypoint v0.6

        vm.startBroadcast(pk);

        DemoLogic logic = new DemoLogic();
        DemoAccount account = new DemoAccount(owner, entrypoint);

        vm.stopBroadcast();

        console.log("---------------------------------------");
        console.log("Deployment Results");
        console.log("---------------------------------------");
        console.log("DemoLogic deployed at:    %s", address(logic));
        console.log("DemoAccount deployed at:  %s", address(account));
        console.log("---------------------------------------");
    }
}
