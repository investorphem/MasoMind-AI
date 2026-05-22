// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
}

contract MasoMindV2 {
    address public owner;
    address public agentWallet;

    // Standardized events that AI registries look for
    event ServiceRequested(address indexed user, address token, uint256 amount, string prompt, string serviceType, uint256 timestamp);
    event ServiceDelivered(address indexed agent, address indexed user, string result, uint256 timestamp);

    modifier onlyAgent() {
        require(msg.sender == agentWallet, "Unauthorized");
        _;
    }

    constructor(address _agentWallet) {
        owner = msg.sender;
        agentWallet = _agentWallet;
    }

    // 🚀 FIX: Payment now goes to the AGENT, not the owner.
    // This ensures your agent wallet shows activity/funds on-chain.
    function requestService(address token, uint256 amount, string calldata prompt, string calldata serviceType) external {
        require(
            IERC20(token).transferFrom(msg.sender, agentWallet, amount),
            "Payment to agent failed"
        );

        emit ServiceRequested(msg.sender, token, amount, prompt, serviceType, block.timestamp);
    }

    // Agent delivers result and officially closes the job
    function deliverResult(address user, string calldata result) external onlyAgent {
        emit ServiceDelivered(msg.sender, user, result, block.timestamp);
    }
}
