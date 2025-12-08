// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract DemoLogic {
    uint256 public count;

    function increment() external {
        count += 1;
    }

    function getCount() external view returns (uint256) {
        return count;
    }
}
