// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

contract MasoMindV2 {
    address public owner;

    // Logs the token used, the amount paid, the prompt, and the service type (Image or Audit)
    event ServiceExecuted(address indexed user, address token, uint256 amount, string prompt, string serviceType, uint256 timestamp);

    constructor() {
        owner = msg.sender;
    }

    // Universal payment router
    function executeService(address token, uint256 amount, string calldata prompt, string calldata serviceType) external {
        require(
            IERC20(token).transferFrom(msg.sender, owner, amount),
            "Payment transfer failed"
        );

        emit ServiceExecuted(msg.sender, token, amount, prompt, serviceType, block.timestamp);
    }
}
