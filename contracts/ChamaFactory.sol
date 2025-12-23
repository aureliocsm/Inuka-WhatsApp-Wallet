// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./Chama.sol";

/**
 * @title ChamaFactory
 * @notice Factory contract to create and manage Chama instances for INUKA Pay
 * @dev Creates new Chama contracts and maintains a registry
 */
contract ChamaFactory {

    // ============ State Variables ============

    address public owner;
    address public walletManager;
    address public tzsAddress;

    // Registry
    mapping(string => address) public chamaByInviteCode;
    mapping(address => address[]) public chamasByCreator;
    address[] public allChamas;

    // Events
    event ChamaCreated(
        address indexed chamaAddress,
        string inviteCode,
        address indexed creator,
        string name
    );

    // ============ Modifiers ============

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    // ============ Constructor ============

    constructor(address _walletManager, address _tzsAddress) {
        owner = msg.sender;
        walletManager = _walletManager;
        tzsAddress = _tzsAddress;
    }

    // ============ Factory Functions ============

    /**
     * @notice Create a new Chama
     * @param name Name of the Chama
     * @param description Description of the Chama
     * @param inviteCode Unique invite code (8 characters)
     * @param sharePriceUSD Share price in USD (with 6 decimals)
     * @param weeklyMinimum Weekly minimum contribution in USD
     * @param loanInterestRate Interest rate for loans (percentage)
     * @param lockupMonths Lockup period in months (default 3)
     * @return chamaAddress Address of the newly created Chama
     */
    function createChama(
        string memory name,
        string memory description,
        string memory inviteCode,
        uint256 sharePriceUSD,
        uint256 weeklyMinimum,
        uint256 loanInterestRate,
        uint256 lockupMonths
    ) external returns (address chamaAddress) {
        // Validate inputs
        require(bytes(inviteCode).length == 8, "Invite code must be 8 characters");
        require(chamaByInviteCode[inviteCode] == address(0), "Invite code already used");
        require(sharePriceUSD > 0, "Share price must be > 0");

        // Create new Chama contract
        Chama newChama = new Chama(
            name,
            description,
            inviteCode,
            msg.sender,
            walletManager,
            tzsAddress,
            sharePriceUSD,
            weeklyMinimum,
            loanInterestRate,
            lockupMonths
        );

        chamaAddress = address(newChama);

        // Register Chama
        chamaByInviteCode[inviteCode] = chamaAddress;
        chamasByCreator[msg.sender].push(chamaAddress);
        allChamas.push(chamaAddress);

        emit ChamaCreated(chamaAddress, inviteCode, msg.sender, name);

        return chamaAddress;
    }

    // ============ View Functions ============

    /**
     * @notice Get Chama address by invite code
     * @param inviteCode The invite code
     * @return Address of the Chama
     */
    function getChamaByInviteCode(string memory inviteCode) external view returns (address) {
        return chamaByInviteCode[inviteCode];
    }

    /**
     * @notice Get all Chamas created by a user
     * @param creator Address of the creator
     * @return Array of Chama addresses
     */
    function getChamasByCreator(address creator) external view returns (address[] memory) {
        return chamasByCreator[creator];
    }

    /**
     * @notice Get all Chamas
     * @return Array of all Chama addresses
     */
    function getAllChamas() external view returns (address[] memory) {
        return allChamas;
    }

    /**
     * @notice Get total number of Chamas
     * @return Total count
     */
    function getTotalChamas() external view returns (uint256) {
        return allChamas.length;
    }

    /**
     * @notice Check if invite code is available
     * @param inviteCode The invite code to check
     * @return True if available
     */
    function isInviteCodeAvailable(string memory inviteCode) external view returns (bool) {
        return chamaByInviteCode[inviteCode] == address(0);
    }

    // ============ Admin Functions ============

    /**
     * @notice Update TZS token address (owner only)
     * @param newTzsAddress New TZS token contract address
     */
    function updateTzsAddress(address newTzsAddress) external onlyOwner {
        tzsAddress = newTzsAddress;
    }

    /**
     * @notice Update wallet manager address (owner only)
     * @param newWalletManager New wallet manager address
     */
    function updateWalletManager(address newWalletManager) external onlyOwner {
        walletManager = newWalletManager;
    }
}
