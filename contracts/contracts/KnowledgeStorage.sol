// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title KnowledgeStorage
/// @notice 可信知识存储与状态管理基础合约（简化版）
contract KnowledgeStorage {
    address public owner;
    uint256 public votingPeriodSeconds = 72 hours;

    enum Status {
        Pending,
        Verified,
        Rejected
    }

    struct Knowledge {
        uint256 id;
        string title;
        string contentHash; // 知识正文内容哈希（实际内容存储在链下/数据库/IPFS）
        string source; // 来源（如论文 DOI、链接等）
        address submitter;
        uint256 createdAt;
        Status status;
    }

    uint256 public nextKnowledgeId;

    mapping(uint256 => Knowledge) public knowledges;

    // ====== 多主体验证（简化可演示版） ======
    // 专家白名单（专家票权重更高）
    mapping(address => bool) public isExpert;

    struct VoteInfo {
        uint256 yesWeight;
        uint256 noWeight;
        uint256 deadline;
        bool finalized;
    }

    // knowledgeId => VoteInfo
    mapping(uint256 => VoteInfo) public votes;
    // knowledgeId => voter => voted?
    mapping(uint256 => mapping(address => bool)) public hasVoted;

    event KnowledgeSubmitted(
        uint256 indexed id,
        address indexed submitter,
        string title,
        string contentHash,
        string source
    );

    event ExpertSet(address indexed account, bool isExpert);
    event VotingPeriodUpdated(uint256 seconds_);
    event KnowledgeVoted(uint256 indexed id, address indexed voter, bool support, uint256 weight);

    event KnowledgeStatusChanged(
        uint256 indexed id,
        Status oldStatus,
        Status newStatus
    );

    constructor() {
        owner = msg.sender;
        nextKnowledgeId = 1;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    function setExpert(address account, bool expert) external onlyOwner {
        isExpert[account] = expert;
        emit ExpertSet(account, expert);
    }

    function setVotingPeriodSeconds(uint256 seconds_) external onlyOwner {
        require(seconds_ >= 60, "Voting period too short");
        votingPeriodSeconds = seconds_;
        emit VotingPeriodUpdated(seconds_);
    }

    /// @notice 提交知识，初始状态为 Pending
    function submitKnowledge(
        string memory _title,
        string memory _contentHash,
        string memory _source
    ) external returns (uint256) {
        require(bytes(_title).length > 0, "Title required");
        require(bytes(_contentHash).length > 0, "Content hash required");

        uint256 id = nextKnowledgeId;
        nextKnowledgeId += 1;

        Knowledge memory k = Knowledge({
            id: id,
            title: _title,
            contentHash: _contentHash,
            source: _source,
            submitter: msg.sender,
            createdAt: block.timestamp,
            status: Status.Pending
        });

        knowledges[id] = k;

        // 初始化投票信息
        votes[id] = VoteInfo({
            yesWeight: 0,
            noWeight: 0,
            deadline: block.timestamp + votingPeriodSeconds,
            finalized: false
        });

        emit KnowledgeSubmitted(id, msg.sender, _title, _contentHash, _source);

        return id;
    }

    /// @notice 用户投票（support=true 表示同意通过）
    /// @dev 权重：专家=2，普通=1（后续可扩展为信誉值）
    function voteKnowledge(uint256 _id, bool support) external {
        Knowledge storage k = knowledges[_id];
        require(k.id != 0, "Knowledge not found");
        require(k.status == Status.Pending, "Not pending");

        VoteInfo storage v = votes[_id];
        require(!v.finalized, "Finalized");
        require(block.timestamp <= v.deadline, "Voting ended");
        require(!hasVoted[_id][msg.sender], "Already voted");

        uint256 weight = isExpert[msg.sender] ? 2 : 1;
        hasVoted[_id][msg.sender] = true;

        if (support) {
            v.yesWeight += weight;
        } else {
            v.noWeight += weight;
        }

        emit KnowledgeVoted(_id, msg.sender, support, weight);
    }

    /// @notice 结束并判定投票结果（任何人可调用）
    /// @dev 规则（与文档一致的简化版）：
    /// - 通过：yes/(yes+no) >= 70%
    /// - 驳回：no/(yes+no) > 40%
    /// - 否则：保持 Pending（可继续补充投票或管理员手动处理）
    function finalizeKnowledge(uint256 _id) external {
        Knowledge storage k = knowledges[_id];
        require(k.id != 0, "Knowledge not found");
        require(k.status == Status.Pending, "Not pending");

        VoteInfo storage v = votes[_id];
        require(!v.finalized, "Finalized");
        require(block.timestamp > v.deadline, "Voting not ended");

        v.finalized = true;

        uint256 yesW = v.yesWeight;
        uint256 noW = v.noWeight;
        uint256 total = yesW + noW;

        if (total == 0) {
            // 无人投票：保持 Pending
            return;
        }

        // 比例判断：避免浮点，使用乘法
        // yes/total >= 0.7  <=> yes*100 >= total*70
        // no/total > 0.4   <=> no*100 > total*40
        Status old = k.status;
        if (yesW * 100 >= total * 70) {
            k.status = Status.Verified;
            emit KnowledgeStatusChanged(_id, old, Status.Verified);
        } else if (noW * 100 > total * 40) {
            k.status = Status.Rejected;
            emit KnowledgeStatusChanged(_id, old, Status.Rejected);
        } else {
            // 保持 Pending，不触发状态变化事件
            k.status = Status.Pending;
        }
    }

    /// @notice 管理员兜底改状态（可选，用于演示/纠错）
    function adminSetKnowledgeStatus(uint256 _id, Status _status) external onlyOwner {
        Knowledge storage k = knowledges[_id];
        require(k.id != 0, "Knowledge not found");

        Status old = k.status;
        k.status = _status;
        emit KnowledgeStatusChanged(_id, old, _status);
    }

    function getKnowledge(uint256 _id) external view returns (Knowledge memory) {
        require(knowledges[_id].id != 0, "Knowledge not found");
        return knowledges[_id];
    }
}

