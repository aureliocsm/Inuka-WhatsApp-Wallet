// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title WalletManager
 * @notice Manages user token balances (ETH and USDT) for WhatsApp Crypto Wallet
 * @dev Handles deposits, withdrawals, and balance tracking
 */
contract WalletManager {

    // ============ State Variables ============

    address public owner;

    // User balances: user_address => token_address => balance
    mapping(address => mapping(address => uint256)) public balances;

    // ETH is represented as address(0)
    address public constant ETH_ADDRESS = address(0);

    // Events
    event Deposit(address indexed user, address indexed token, uint256 amount);
    event Withdrawal(address indexed user, address indexed token, uint256 amount, address to);
    event Transfer(address indexed from, address indexed to, address indexed token, uint256 amount);

    // ============ Modifiers ============

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    // ============ Constructor ============

    constructor() {
        owner = msg.sender;
    }

    // ============ Deposit Functions ============

    /**
     * @notice Deposit ETH to user's wallet
     * @param user Address of the user
     */
    function depositETH(address user) external payable {
        require(msg.value > 0, "Amount must be > 0");
        balances[user][ETH_ADDRESS] += msg.value;
        emit Deposit(user, ETH_ADDRESS, msg.value);
    }

    /**
     * @notice Deposit ERC20 tokens (USDT) to user's wallet
     * @param user Address of the user
     * @param token Address of the token contract
     * @param amount Amount to deposit
     */
    function depositToken(address user, address token, uint256 amount) external {
        require(amount > 0, "Amount must be > 0");
        require(token != ETH_ADDRESS, "Use depositETH for ETH");

        // Transfer tokens from sender to this contract
        (bool success, bytes memory data) = token.call(
            abi.encodeWithSelector(0x23b872dd, msg.sender, address(this), amount)
        );
        require(success && (data.length == 0 || abi.decode(data, (bool))), "Transfer failed");

        balances[user][token] += amount;
        emit Deposit(user, token, amount);
    }

    // ============ Withdrawal Functions ============

    /**
     * @notice Withdraw ETH from user's wallet
     * @param amount Amount to withdraw
     * @param to Destination address
     */
    function withdrawETH(uint256 amount, address payable to) external {
        require(balances[msg.sender][ETH_ADDRESS] >= amount, "Insufficient balance");

        balances[msg.sender][ETH_ADDRESS] -= amount;

        (bool success, ) = to.call{value: amount}("");
        require(success, "ETH transfer failed");

        emit Withdrawal(msg.sender, ETH_ADDRESS, amount, to);
    }

    /**
     * @notice Withdraw ERC20 tokens from user's wallet
     * @param token Address of the token contract
     * @param amount Amount to withdraw
     * @param to Destination address
     */
    function withdrawToken(address token, uint256 amount, address to) external {
        require(token != ETH_ADDRESS, "Use withdrawETH for ETH");
        require(balances[msg.sender][token] >= amount, "Insufficient balance");

        balances[msg.sender][token] -= amount;

        (bool success, bytes memory data) = token.call(
            abi.encodeWithSelector(0xa9059cbb, to, amount)
        );
        require(success && (data.length == 0 || abi.decode(data, (bool))), "Transfer failed");

        emit Withdrawal(msg.sender, token, amount, to);
    }

    // ============ Transfer Functions ============

    /**
     * @notice Transfer tokens between users (internal)
     * @param from Sender address
     * @param to Receiver address
     * @param token Token address (ETH_ADDRESS for ETH)
     * @param amount Amount to transfer
     */
    function internalTransfer(
        address from,
        address to,
        address token,
        uint256 amount
    ) external {
        require(balances[from][token] >= amount, "Insufficient balance");

        balances[from][token] -= amount;
        balances[to][token] += amount;

        emit Transfer(from, to, token, amount);
    }

    // ============ View Functions ============

    /**
     * @notice Get user's balance for a specific token
     * @param user User address
     * @param token Token address
     * @return User's balance
     */
    function getBalance(address user, address token) external view returns (uint256) {
        return balances[user][token];
    }

    /**
     * @notice Get user's ETH balance
     * @param user User address
     * @return User's ETH balance
     */
    function getETHBalance(address user) external view returns (uint256) {
        return balances[user][ETH_ADDRESS];
    }

    // ============ Admin Functions ============

    /**
     * @notice Emergency withdrawal (owner only)
     * @param token Token address
     * @param amount Amount to withdraw
     */
    function emergencyWithdraw(address token, uint256 amount) external onlyOwner {
        if (token == ETH_ADDRESS) {
            payable(owner).transfer(amount);
        } else {
            (bool success, ) = token.call(
                abi.encodeWithSelector(0xa9059cbb, owner, amount)
            );
            require(success, "Transfer failed");
        }
    }

    // ============ Receive Function ============

    receive() external payable {
        balances[msg.sender][ETH_ADDRESS] += msg.value;
        emit Deposit(msg.sender, ETH_ADDRESS, msg.value);
    }
}
