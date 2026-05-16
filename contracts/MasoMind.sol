// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) extern returns (bool);
}

contract MasoMind {
    IERC20 public cUSD;
    address public owner;

    // Triggered whenever a user successfully pays for an image prompt
    event ImageRequested(address indexed user, string prompt, uint256 timestamp);

    constructor(address _cUSD) {
        // Celo Mainnet cUSD Address: 0x765DE816845861e75A25fCA122bb6898B8B1282a
        cUSD = IERC20(_cUSD);
        owner = msg.sender;
    }

    // Front-end calls this to pay 0.10 cUSD for an image prompt
    function requestImage(string calldata prompt) external {
        uint256 cost = 100000000000000000; // 0.10 cUSD (18 decimals)
        
        require(
            cUSD.transferFrom(msg.sender, owner, cost),
            "cUSD micro-payment failed"
        );

        emit ImageRequested(msg.sender, prompt, block.timestamp);
    }
}
