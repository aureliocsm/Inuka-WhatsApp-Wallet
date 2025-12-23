// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

/**
 * @title Chama
 * @notice Group savings and lending contract for INUKA Pay
 * @dev Manages member contributions, loans with approval voting, and withdrawals
 * @custom:security-contact WhatsApp Crypto Wallet Team
 */
contract Chama {

    // ============ Structs ============

    struct Member {
        address wallet;
        uint256 totalContributions;
        uint256 ethShare;
        uint256 tzsShare;
        uint256 sharesOwned;
        uint256 joinedAt;
        uint256 lastContribution;
        uint256 missedContributions;
        bool isAdmin;
        bool isActive;
    }

    struct Loan {
        address borrower;
        uint256 amount;
        address token;
        uint256 interestRate;
        uint256 totalDue;
        uint256 amountRepaid;
        uint256 requestedAt;
        uint256 disbursedAt;
        uint256 dueDate;
        uint256 approvalsCount;
        uint256 rejectionsCount;
        bool isApproved;
        bool isDisbursed;
        bool isActive;
        bool isRepaid;
    }

    struct LoanVote {
        bool hasVoted;
        bool approved;
    }

    // ============ State Variables ============

    string public name;
    string public description;
    string public inviteCode;
    address public creator;
    address public walletManager;

    uint256 public sharePriceUSD; // Share price in USD (with 6 decimals)
    uint256 public weeklyMinimumContribution; // Weekly minimum in USD
    uint256 public loanInterestRate; // Interest rate percentage (e.g., 5 = 5%)
    uint256 public lockupPeriodMonths; // Lockup period (default 3 months)
    uint256 public minVotesForApproval; // Minimum votes needed (default 51% of members)

    uint256 public totalContributions; // Total USD contributed
    uint256 public totalETHHoldings; // Total ETH held
    uint256 public totalTZSHoldings; // Total TZS held
    uint256 public memberCount;

    address public constant ETH_ADDRESS = address(0);
    address public tzsAddress;

    // Mappings
    mapping(address => Member) public members;
    mapping(uint256 => Loan) public loans;
    mapping(uint256 => mapping(address => LoanVote)) public loanVotes; // loanId => voter => vote

    address[] public memberList;
    uint256 public loanCounter;

    bool public isActive;

    // Events
    event MemberJoined(address indexed member, uint256 timestamp);
    event ContributionMade(address indexed member, address indexed token, uint256 amount, uint256 shares);
    event LoanRequested(uint256 indexed loanId, address indexed borrower, uint256 amount, address token, uint256 durationDays);
    event LoanVoted(uint256 indexed loanId, address indexed voter, bool approved);
    event LoanApproved(uint256 indexed loanId, uint256 approvalsCount);
    event LoanDisbursed(uint256 indexed loanId, address indexed borrower, uint256 amount);
    event LoanRepaid(uint256 indexed loanId, address indexed borrower, uint256 amount, bool fullyRepaid);
    event WithdrawalMade(address indexed member, uint256 amount, address token);

    // ============ Modifiers ============

    modifier onlyMember() {
        require(members[msg.sender].isActive, "Not a member");
        _;
    }

    modifier onlyAdmin() {
        require(members[msg.sender].isAdmin, "Not an admin");
        _;
    }

    // ============ Constructor ============

    constructor(
        string memory _name,
        string memory _description,
        string memory _inviteCode,
        address _creator,
        address _walletManager,
        address _tzsAddress,
        uint256 _sharePriceUSD,
        uint256 _weeklyMinimum,
        uint256 _loanInterestRate,
        uint256 _lockupMonths
    ) {
        name = _name;
        description = _description;
        inviteCode = _inviteCode;
        creator = _creator;
        walletManager = _walletManager;
        tzsAddress = _tzsAddress;
        sharePriceUSD = _sharePriceUSD;
        weeklyMinimumContribution = _weeklyMinimum;
        loanInterestRate = _loanInterestRate;
        lockupPeriodMonths = _lockupMonths;
        minVotesForApproval = 51; // 51% approval needed
        isActive = true;

        // Add creator as first member and admin
        members[_creator] = Member({
            wallet: _creator,
            totalContributions: 0,
            ethShare: 0,
            tzsShare: 0,
            sharesOwned: 0,
            joinedAt: block.timestamp,
            lastContribution: 0,
            missedContributions: 0,
            isAdmin: true,
            isActive: true
        });

        memberList.push(_creator);
        memberCount = 1;
    }

    // ============ Member Functions ============

    /**
     * @notice Join the Chama
     */
    function joinChama() external {
        require(isActive, "Chama is not active");
        require(!members[msg.sender].isActive, "Already a member");

        members[msg.sender] = Member({
            wallet: msg.sender,
            totalContributions: 0,
            ethShare: 0,
            tzsShare: 0,
            sharesOwned: 0,
            joinedAt: block.timestamp,
            lastContribution: 0,
            missedContributions: 0,
            isAdmin: false,
            isActive: true
        });

        memberList.push(msg.sender);
        memberCount++;

        emit MemberJoined(msg.sender, block.timestamp);
    }

    /**
     * @notice Contribute to the Chama
     * @param token Token address (ETH_ADDRESS for ETH or TZS token address)
     * @param amount Amount to contribute (in token's smallest unit)
     * @param amountUSD Amount in USD equivalent (with 6 decimals)
     */
    function contribute(address token, uint256 amount, uint256 amountUSD) external payable onlyMember {
        require(amount > 0, "Amount must be > 0");
        require(token == ETH_ADDRESS || token == tzsAddress, "Invalid token");

        Member storage member = members[msg.sender];

        // Handle token transfer
        if (token == ETH_ADDRESS) {
            require(msg.value == amount, "ETH amount mismatch");
            member.ethShare += amount;
            totalETHHoldings += amount;
        } else {
            // Transfer TZS tokens from sender to contract
            require(IERC20(tzsAddress).transferFrom(msg.sender, address(this), amount), "TZS transfer failed");
            member.tzsShare += amount;
            totalTZSHoldings += amount;
        }

        // Update member contribution
        member.totalContributions += amountUSD;
        member.lastContribution = block.timestamp;

        // Calculate shares
        uint256 shares = (amountUSD * 1e6) / sharePriceUSD;
        member.sharesOwned += shares;

        totalContributions += amountUSD;

        emit ContributionMade(msg.sender, token, amount, shares);
    }

    /**
     * @notice Withdraw from Chama (after lockup period)
     * @param token Token to withdraw (ETH_ADDRESS or TZS)
     * @param amount Amount to withdraw
     */
    function withdraw(address token, uint256 amount) external onlyMember {
        Member storage member = members[msg.sender];

        // Check lockup period
        require(
            block.timestamp >= member.joinedAt + (lockupPeriodMonths * 30 days),
            "Lockup period not met"
        );

        // Check balance and transfer
        if (token == ETH_ADDRESS) {
            require(member.ethShare >= amount, "Insufficient ETH share");
            require(totalETHHoldings >= amount, "Insufficient contract balance");
            member.ethShare -= amount;
            totalETHHoldings -= amount;

            // Transfer ETH
            (bool success, ) = msg.sender.call{value: amount}("");
            require(success, "ETH transfer failed");
        } else {
            require(member.tzsShare >= amount, "Insufficient TZS share");
            require(totalTZSHoldings >= amount, "Insufficient contract balance");
            member.tzsShare -= amount;
            totalTZSHoldings -= amount;

            // Transfer TZS tokens
            require(IERC20(tzsAddress).transfer(msg.sender, amount), "TZS transfer failed");
        }

        emit WithdrawalMade(msg.sender, amount, token);
    }

    // ============ Loan Functions ============

    /**
     * @notice Request a loan from the Chama
     * @param token Token to borrow (ETH_ADDRESS or TZS)
     * @param amount Amount to borrow
     * @param durationDays Loan duration in days
     */
    function requestLoan(address token, uint256 amount, uint256 durationDays) external onlyMember returns (uint256) {
        require(amount > 0, "Amount must be > 0");
        require(token == ETH_ADDRESS || token == tzsAddress, "Invalid token");
        require(durationDays >= 7 && durationDays <= 365, "Duration must be 7-365 days");

        // Check available liquidity
        uint256 availableLiquidity;
        if (token == ETH_ADDRESS) {
            availableLiquidity = totalETHHoldings;
        } else {
            availableLiquidity = totalTZSHoldings;
        }
        require(availableLiquidity >= amount, "Insufficient liquidity");

        // Calculate interest and total due
        uint256 interest = (amount * loanInterestRate) / 100;
        uint256 totalDue = amount + interest;

        // Create loan request
        loans[loanCounter] = Loan({
            borrower: msg.sender,
            amount: amount,
            token: token,
            interestRate: loanInterestRate,
            totalDue: totalDue,
            amountRepaid: 0,
            requestedAt: block.timestamp,
            disbursedAt: 0,
            dueDate: block.timestamp + (durationDays * 1 days),
            approvalsCount: 0,
            rejectionsCount: 0,
            isApproved: false,
            isDisbursed: false,
            isActive: true,
            isRepaid: false
        });

        emit LoanRequested(loanCounter, msg.sender, amount, token, durationDays);

        uint256 currentLoanId = loanCounter;
        loanCounter++;
        return currentLoanId;
    }

    /**
     * @notice Vote on a loan request
     * @param loanId ID of the loan to vote on
     * @param approve True to approve, false to reject
     */
    function voteOnLoan(uint256 loanId, bool approve) external onlyMember {
        Loan storage loan = loans[loanId];
        require(loan.isActive, "Loan not active");
        require(!loan.isApproved, "Loan already approved");
        require(!loan.isDisbursed, "Loan already disbursed");
        require(loan.borrower != msg.sender, "Cannot vote on own loan");

        LoanVote storage vote = loanVotes[loanId][msg.sender];
        require(!vote.hasVoted, "Already voted");

        vote.hasVoted = true;
        vote.approved = approve;

        if (approve) {
            loan.approvalsCount++;
        } else {
            loan.rejectionsCount++;
        }

        emit LoanVoted(loanId, msg.sender, approve);

        // Check if loan should be approved
        uint256 requiredVotes = (memberCount * minVotesForApproval) / 100;
        if (loan.approvalsCount >= requiredVotes) {
            loan.isApproved = true;
            emit LoanApproved(loanId, loan.approvalsCount);
        }
    }

    /**
     * @notice Disburse an approved loan
     * @param loanId ID of the loan to disburse
     */
    function disburseLoan(uint256 loanId) external {
        Loan storage loan = loans[loanId];
        require(loan.isActive, "Loan not active");
        require(loan.isApproved, "Loan not approved");
        require(!loan.isDisbursed, "Already disbursed");
        require(loan.borrower == msg.sender, "Not your loan");

        // Update loan status
        loan.isDisbursed = true;
        loan.disbursedAt = block.timestamp;

        // Update liquidity
        if (loan.token == ETH_ADDRESS) {
            require(totalETHHoldings >= loan.amount, "Insufficient ETH");
            totalETHHoldings -= loan.amount;

            // Transfer ETH to borrower
            (bool success, ) = msg.sender.call{value: loan.amount}("");
            require(success, "ETH transfer failed");
        } else {
            require(totalTZSHoldings >= loan.amount, "Insufficient TZS");
            totalTZSHoldings -= loan.amount;

            // Transfer TZS tokens to borrower
            require(IERC20(tzsAddress).transfer(msg.sender, loan.amount), "TZS transfer failed");
        }

        emit LoanDisbursed(loanId, msg.sender, loan.amount);
    }

    /**
     * @notice Repay a loan
     * @param loanId ID of the loan
     * @param amount Amount to repay
     */
    function repayLoan(uint256 loanId, uint256 amount) external payable {
        Loan storage loan = loans[loanId];
        require(loan.isActive, "Loan not active");
        require(loan.isDisbursed, "Loan not disbursed");
        require(loan.borrower == msg.sender, "Not your loan");
        require(amount > 0, "Amount must be > 0");

        uint256 remaining = loan.totalDue - loan.amountRepaid;
        require(amount <= remaining, "Amount exceeds remaining");

        loan.amountRepaid += amount;

        // Handle token repayment
        if (loan.token == ETH_ADDRESS) {
            require(msg.value == amount, "ETH amount mismatch");
            totalETHHoldings += amount;
        } else {
            require(IERC20(tzsAddress).transferFrom(msg.sender, address(this), amount), "TZS transfer failed");
            totalTZSHoldings += amount;
        }

        bool fullyRepaid = false;
        if (loan.amountRepaid >= loan.totalDue) {
            loan.isActive = false;
            loan.isRepaid = true;
            fullyRepaid = true;
        }

        emit LoanRepaid(loanId, msg.sender, amount, fullyRepaid);
    }

    // ============ View Functions ============

    /**
     * @notice Get member details
     * @param memberAddress Address of the member
     */
    function getMember(address memberAddress) external view returns (Member memory) {
        return members[memberAddress];
    }

    /**
     * @notice Get loan details
     * @param loanId ID of the loan
     */
    function getLoan(uint256 loanId) external view returns (Loan memory) {
        return loans[loanId];
    }

    /**
     * @notice Check if member has voted on a loan
     * @param loanId ID of the loan
     * @param voter Address of the voter
     */
    function hasVotedOnLoan(uint256 loanId, address voter) external view returns (bool, bool) {
        LoanVote memory vote = loanVotes[loanId][voter];
        return (vote.hasVoted, vote.approved);
    }

    /**
     * @notice Get Chama summary
     */
    function getChamaSummary() external view returns (
        uint256 _totalContributions,
        uint256 _totalETH,
        uint256 _totalTZS,
        uint256 _memberCount,
        bool _isActive
    ) {
        return (
            totalContributions,
            totalETHHoldings,
            totalTZSHoldings,
            memberCount,
            isActive
        );
    }

    /**
     * @notice Get all members
     */
    function getAllMembers() external view returns (address[] memory) {
        return memberList;
    }

    /**
     * @notice Check if user is a member
     * @param user Address to check
     */
    function isMember(address user) external view returns (bool) {
        return members[user].isActive;
    }

    /**
     * @notice Get votes required for loan approval
     */
    function getRequiredVotes() external view returns (uint256) {
        return (memberCount * minVotesForApproval) / 100;
    }

    // ============ Admin Functions ============

    /**
     * @notice Update Chama settings (admin only)
     */
    function updateSettings(
        uint256 _sharePriceUSD,
        uint256 _weeklyMinimum,
        uint256 _loanInterestRate,
        uint256 _minVotesForApproval
    ) external onlyAdmin {
        require(_minVotesForApproval > 0 && _minVotesForApproval <= 100, "Invalid approval percentage");
        sharePriceUSD = _sharePriceUSD;
        weeklyMinimumContribution = _weeklyMinimum;
        loanInterestRate = _loanInterestRate;
        minVotesForApproval = _minVotesForApproval;
    }

    /**
     * @notice Add or remove admin (creator only)
     * @param member Address of the member
     * @param isAdmin True to make admin, false to remove
     */
    function setAdmin(address member, bool isAdmin) external {
        require(msg.sender == creator, "Only creator");
        require(members[member].isActive, "Not a member");
        members[member].isAdmin = isAdmin;
    }

    /**
     * @notice Dissolve Chama (admin only)
     */
    function dissolveChama() external onlyAdmin {
        isActive = false;
    }

    /**
     * @notice Receive ETH
     */
    receive() external payable {}
}
