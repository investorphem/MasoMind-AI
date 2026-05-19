// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

contract MasoMindV2 {
    address public owner;
    address public agentWallet; // Your Registered Agent: 0x4f9B9...

    // 1. Logs when a user pays and asks the AI a question
    event ServiceRequested(address indexed user, address token, uint256 amount, string prompt, string serviceType, uint256 timestamp);
    
    // 2. Logs when the Autonomous Agent completes the task
    event ServiceDelivered(address indexed agent, address indexed user, string result, uint256 timestamp);

    // Security: Only the Agent can call functions with this modifier
    modifier onlyAgent() {
        require(msg.sender == agentWallet, "Unauthorized: MasoMind Agent Only");
        _;
    }

    // When deploying, you will pass your Agent's 0x4f9B9... address here
    constructor(address _agentWallet) {
        owner = msg.sender;
        agentWallet = _agentWallet;
    }

    // Step 1: User calls this to pay and request a service
    function requestService(address token, uint256 amount, string calldata prompt, string calldata serviceType) external {
        require(
            IERC20(token).transferFrom(msg.sender, owner, amount),
            "Payment transfer failed"
        );

        emit ServiceRequested(msg.sender, token, amount, prompt, serviceType, block.timestamp);
    }

    // Step 2: The Agent autonomously calls this to deliver the final result
    function deliverResult(address user, string calldata result) external onlyAgent {
        emit ServiceDelivered(msg.sender, user, result, block.timestamp);
    }
}
