package main

import (
	"encoding/json"
	"fmt"
	"log"
	"strconv"
	"strings"

	"chainmaker/pb/protogo"
	"chainmaker/shim"
)

// KnowledgeContract 核心合约对象
type KnowledgeContract struct{}

// ========== 核心数据结构定义 ==========
// KnowledgeStatus 知识可信度状态
type KnowledgeStatus int32

const (
	StatusPending  KnowledgeStatus = 0 // 待验证
	StatusApproved KnowledgeStatus = 1 // 已通过
	StatusRejected KnowledgeStatus = 2 // 已驳回
)

// Knowledge 知识核心元数据结构（链上存储）
type Knowledge struct {
	ID               string          `json:"id"`                 // 唯一标识
	ContentHash      string          `json:"content_hash"`       // IPFS知识正文哈希
	SourceCredential string          `json:"source_credential"`  // 权威来源凭证（DOI/官方链接）
	Submitter        string          `json:"submitter"`          // 提交者区块链地址
	Timestamp        int64           `json:"timestamp"`          // 上链时间戳（毫秒）
	Status           KnowledgeStatus `json:"status"`             // 可信度状态
	UpdateRecordHash string          `json:"update_record_hash"` // 历史更新记录哈希
	VerificationID   string          `json:"verification_id"`    // 关联的验证ID
}

// VerificationVote 验证投票结构
type VerificationVote struct {
	ID           string `json:"id"`            // 验证唯一ID
	KnowledgeID  string `json:"knowledge_id"`  // 关联的知识ID
	TotalVotes   int64  `json:"total_votes"`   // 总加权票数
	ApproveVotes int64  `json:"approve_votes"` // 同意加权票数
	RejectVotes  int64  `json:"reject_votes"`  // 反对加权票数
	StartTime    int64  `json:"start_time"`    // 投票开始时间（毫秒）
	EndTime      int64  `json:"end_time"`      // 投票结束时间（毫秒）
}

// RoleType 用户角色
type RoleType int32

const (
	RoleNormal RoleType = 0 // 普通用户（权重1）
	RoleExpert RoleType = 1 // 领域专家（权重2）
	RoleAdmin  RoleType = 2 // 管理员
)

// ========== 合约核心方法 ==========
// InitContract 合约初始化
func (kc *KnowledgeContract) InitContract(stub shim.CMStubInterface) protogo.Response {
	return shim.Success([]byte("Init Knowledge Contract Success"))
}

// UpgradeContract 合约升级
func (kc *KnowledgeContract) UpgradeContract(stub shim.CMStubInterface) protogo.Response {
	return shim.Success([]byte("Upgrade Knowledge Contract Success"))
}

// InvokeContract 合约调用入口（分发方法）
func (kc *KnowledgeContract) InvokeContract(stub shim.CMStubInterface) protogo.Response {
	method := string(stub.GetArgs()["method"])
	switch method {
	// 知识管理
	case "submitKnowledge":
		return kc.SubmitKnowledge(stub)
	case "updateKnowledge":
		return kc.UpdateKnowledge(stub)
	case "queryKnowledgeById":
		return kc.QueryKnowledgeById(stub)
	case "queryKnowledgeByIds":
		return kc.QueryKnowledgeByIds(stub)
	// 验证投票
	case "castVote":
		return kc.CastVote(stub)
	case "judgeVerificationResult":
		return kc.JudgeVerificationResult(stub)
	default:
		return shim.Error("invalid method: " + method)
	}
}

// ========== 知识管理核心方法 ==========
// SubmitKnowledge 提交知识上链
func (kc *KnowledgeContract) SubmitKnowledge(stub shim.CMStubInterface) protogo.Response {
	params := stub.GetArgs()
	// 获取参数
	id := string(params["id"])
	contentHash := string(params["content_hash"])
	sourceCredential := string(params["source_credential"])
	submitter := string(params["submitter"])
	updateRecordHash := string(params["update_record_hash"]) // 首次提交为空
	voteDurationStr := string(params["vote_duration_ms"])
	timestampStr := string(params["timestamp_ms"])	// 时间戳（毫秒）必须由业务侧传入，合约不使用本地系统时间

	// 参数校验
	if id == "" || contentHash == "" || sourceCredential == "" || submitter == "" || timestampStr == "" {
		return shim.Error("params error: id/content_hash/source_credential/submitter/timestamp_ms must not empty")
	}

	// 检查知识ID是否已存在（替换HasStateFromKeyByte）
	key := "knowledge_" + id
	result, err := stub.GetStateFromKeyByte(key)
	if err != nil {
		return shim.Error("check knowledge exist failed: " + err.Error())
	}
	if len(result) > 0 {
		return shim.Error("knowledge id already exist")
	}

	// 解析时间戳
	ts, err := strconv.ParseInt(timestampStr, 10, 64)
	if err != nil || ts <= 0 {
		return shim.Error("params error: timestamp_ms must be valid positive integer")
	}

	// 使用业务侧传入的投票周期（毫秒），若未传入使用默认72小时
	var voteDurationMillis int64 = 72 * 3600 * 1000
	if voteDurationStr != "" {
		if v, err := strconv.ParseInt(voteDurationStr, 10, 64); err == nil && v > 0 {
			voteDurationMillis = v
		}
	}

	// 构建知识对象，并生成唯一的 verification id（包含业务侧时间戳）
	verificationID := "verify_" + id + "_" + strconv.FormatInt(ts, 10)
	knowledge := &Knowledge{
		ID:               id,
		ContentHash:      contentHash,
		SourceCredential: sourceCredential,
		Submitter:        submitter,
		Timestamp:        ts,
		Status:           StatusPending,
		UpdateRecordHash: updateRecordHash,
		VerificationID:   verificationID, // 关联验证ID
	}

	// 序列化存储
	knowledgeBytes, err := json.Marshal(knowledge)
	if err != nil {
		return shim.Error("marshal knowledge failed: " + err.Error())
	}
	err = stub.PutStateFromKeyByte(key, knowledgeBytes)
	if err != nil {
		return shim.Error("save knowledge failed: " + err.Error())
	}

	// 初始化验证投票（周期由业务侧传入），StartTime 使用业务侧传入的 timestamp
	err = kc.initVerificationVote(stub, knowledge.VerificationID, id, ts, voteDurationMillis)
	if err != nil {
		return shim.Error("init verification vote failed: " + err.Error())
	}

	// 发送事件（包含业务侧时间戳）
	stub.EmitEvent("KnowledgeSubmitted", []string{id, submitter, timestampStr})

	stub.Log("[submitKnowledge] success, id: " + id)
	return shim.Success([]byte("submit knowledge success, id: " + id))
}

// UpdateKnowledge 更新知识（仅提交者/管理员可操作）
func (kc *KnowledgeContract) UpdateKnowledge(stub shim.CMStubInterface) protogo.Response {
	params := stub.GetArgs()
	id := string(params["id"])
	newContentHash := string(params["new_content_hash"])
	newSourceCredential := string(params["new_source_credential"])
	operator := string(params["operator"])
	operatorRole := string(params["operator_role"])
	newUpdateRecordHash := string(params["new_update_record_hash"])
	voteDurationStr := string(params["vote_duration_ms"]) // 可选，更新后重新发起投票的时长（ms）
	timestampStr := string(params["timestamp_ms"])        // 更新时间戳必须由业务侧提供

	// 参数校验
	if id == "" || newContentHash == "" || operator == "" || timestampStr == ""{
		return shim.Error("params error: id/new_content_hash/operator/timestampStr must not empty")
	}

	// 查询原有知识
	key := "knowledge_" + id
	knowledgeBytes, err := stub.GetStateFromKeyByte(key)
	if err != nil {
		return shim.Error("get knowledge failed: " + err.Error())
	}
	if len(knowledgeBytes) == 0 {
		return shim.Error("knowledge not found")
	}

	// 反序列化
	var knowledge Knowledge
	err = json.Unmarshal(knowledgeBytes, &knowledge)
	if err != nil {
		return shim.Error("unmarshal knowledge failed: " + err.Error())
	}

	// 权限校验：仅提交者或管理员可更新
	if operator != knowledge.Submitter && !kc.isAdminRole(operatorRole) {
		return shim.Error("permission denied: only submitter or admin can update")
	}

	// 更新字段
	knowledge.ContentHash = newContentHash
	if newSourceCredential != "" {
		knowledge.SourceCredential = newSourceCredential
	}
	knowledge.UpdateRecordHash = newUpdateRecordHash

	// 解析时间戳
	ts, err := strconv.ParseInt(timestampStr, 10, 64)
	if err != nil || ts <= 0 {
		return shim.Error("params error: timestamp_ms must be valid positive integer")
	}
	knowledge.Timestamp = ts

	// 更新后需要重新发起验证投票
	// 生成新的 verification id（使用业务侧提供的 timestamp）
	knowledge.Status = StatusPending // 更新后状态重置为待验证
	newVerifyID := "verify_" + id + "_" + timestampStr
	knowledge.VerificationID = newVerifyID

	// 重新序列化存储
	newKnowledgeBytes, err := json.Marshal(knowledge)
	if err != nil {
		return shim.Error("marshal new knowledge failed: " + err.Error())
	}
	err = stub.PutStateFromKeyByte(key, newKnowledgeBytes)
	if err != nil {
		return shim.Error("update knowledge failed: " + err.Error())
	}

	// 初始化新的验证投票，使用业务侧传入的投票周期（若为空则使用默认72小时）。StartTime 使用业务侧 timestamp
	var voteDurationMillis int64 = 72 * 3600 * 1000
	if voteDurationStr != "" {
		if v, err := strconv.ParseInt(voteDurationStr, 10, 64); err == nil && v > 0 {
			voteDurationMillis = v
		}
	}
	if err := kc.initVerificationVote(stub, knowledge.VerificationID, id, ts, voteDurationMillis); err != nil {
		return shim.Error("init verification vote after update failed: " + err.Error())
	}

	// 发送事件
	stub.EmitEvent("KnowledgeUpdated", []string{id, operator, newContentHash})

	stub.Log("[updateKnowledge] success, id: " + id)
	return shim.Success([]byte("update knowledge success, id: " + id))
}

// QueryKnowledgeById 根据ID查询知识
func (kc *KnowledgeContract) QueryKnowledgeById(stub shim.CMStubInterface) protogo.Response {
	params := stub.GetArgs()
	id := string(params["id"])
	if id == "" {
		return shim.Error("params error: id must not empty")
	}

	key := "knowledge_" + id
	result, err := stub.GetStateFromKeyByte(key)
	if err != nil {
		return shim.Error("query knowledge failed: " + err.Error())
	}
	if len(result) == 0 {
		return shim.Error("knowledge not found")
	}

	stub.Log("[queryKnowledgeById] success, id: " + id)
	return shim.Success(result)
}

// QueryKnowledgeByIds 批量根据ID查询知识
func (kc *KnowledgeContract) QueryKnowledgeByIds(stub shim.CMStubInterface) protogo.Response {
	params := stub.GetArgs()
	idsStr := string(params["ids"]) // 传入逗号分隔的ID字符串，例如 "id1,id2,id3"
	if idsStr == "" {
		return shim.Error("params error: ids must not empty")
	}

	ids := strings.Split(idsStr, ",")
	var results []*Knowledge

	for _, id := range ids {
		if id == "" {
			continue
		}
		key := "knowledge_" + id
		knowledgeBytes, err := stub.GetStateFromKeyByte(key)
		if err != nil {
			// 如果单个查询失败，记录日志并跳过
			stub.Log("[queryKnowledgeByIds] query single knowledge failed, id: " + id + ", error: " + err.Error())
			continue
		}
		if len(knowledgeBytes) == 0 {
			continue
		}

		var knowledge Knowledge
		err = json.Unmarshal(knowledgeBytes, &knowledge)
		if err != nil {
			stub.Log("[queryKnowledgeByIds] unmarshal knowledge failed, id: " + id + ", error: " + err.Error())
			continue
		}
		results = append(results, &knowledge)
	}

	resultBytes, err := json.Marshal(results)
	if err != nil {
		return shim.Error("marshal batch results failed: " + err.Error())
	}

	stub.Log("[queryKnowledgeByIds] success, count: " + strconv.Itoa(len(results)))
	return shim.Success(resultBytes)
}


// ========== 验证投票核心方法 ==========
// initVerificationVote 初始化验证投票（72小时有效期）
func (kc *KnowledgeContract) initVerificationVote(stub shim.CMStubInterface, verifyID, knowledgeID string, startTimeMillis, durationMillis int64) error {
	// startTimeMillis 必须由业务侧传入以保证确定性
	if startTimeMillis <= 0 {
		return fmt.Errorf("startTimeMillis must be positive")
	}
	if durationMillis <= 0 {
		durationMillis = 72 * 3600 * 1000
	}
	vote := &VerificationVote{
		ID:           verifyID,
		KnowledgeID:  knowledgeID,
		TotalVotes:   0,
		ApproveVotes: 0,
		RejectVotes:  0,
		StartTime:    startTimeMillis,
		EndTime:      startTimeMillis + durationMillis,
	}

	// 序列化存储
	voteBytes, err := json.Marshal(vote)
	if err != nil {
		return err
	}
	err = stub.PutStateFromKeyByte("vote_"+verifyID, voteBytes)
	if err != nil {
		return err
	}

	// 初始化已投票地址集合（空map）
	votedMap := make(map[string]bool)
	votedBytes, err := json.Marshal(votedMap)
	if err != nil {
		return err
	}
	err = stub.PutStateFromKeyByte("vote_voted_"+verifyID, votedBytes)
	if err != nil {
		return err
	}

	return nil
}

// CastVote 提交投票
func (kc *KnowledgeContract) CastVote(stub shim.CMStubInterface) protogo.Response {
	params := stub.GetArgs()
	verifyID := string(params["verify_id"])
	voter := string(params["voter"])
	voteTypeStr := string(params["vote_type"]) // 0:反对,1:同意
	voterRoleStr := string(params["voter_role"]) // 传入角色: 0/1/2
	currentTimeStr := string(params["current_time_ms"]) // 调用方提供当前时间（ms），合约不使用系统时间

	// 参数校验
	if verifyID == "" || voter == "" || voteTypeStr == "" || currentTimeStr == "" {
		return shim.Error("params error: verify_id/voter/vote_type/current_time_ms must not empty")
	}
	voteType, err := strconv.Atoi(voteTypeStr)
	if err != nil || (voteType != 0 && voteType != 1) {
		return shim.Error("vote_type must be 0 (reject) or 1 (approve)")
	}

	// 获取投票信息
	voteKey := "vote_" + verifyID
	voteBytes, err := stub.GetStateFromKeyByte(voteKey)
	if err != nil {
		return shim.Error("get vote info failed: " + err.Error())
	}
	if len(voteBytes) == 0 {
		return shim.Error("vote not found")
	}

	// 反序列化
	var vote VerificationVote
	err = json.Unmarshal(voteBytes, &vote)
	if err != nil {
		return shim.Error("unmarshal vote failed: " + err.Error())
	}

	currentTime, err := strconv.ParseInt(currentTimeStr, 10, 64)
	if err != nil {
		return shim.Error("params error: current_time_ms invalid")
	}
	if currentTime < vote.StartTime || currentTime > vote.EndTime {
		return shim.Error("vote is not in valid time range")
	}

	// 检查是否已投票（防作弊）
	votedKey := "vote_voted_" + verifyID
	votedBytes, err := stub.GetStateFromKeyByte(votedKey)
	if err != nil {
		return shim.Error("get voted addresses failed: " + err.Error())
	}
	var votedMap map[string]bool
	err = json.Unmarshal(votedBytes, &votedMap)
	if err != nil {
		votedMap = make(map[string]bool)
	}
	if votedMap[voter] {
		return shim.Error("voter already cast vote")
	}

	// 获取投票权重（角色由业务侧传入，普通用户1，专家2）
	weight := int64(1)
	if voterRoleStr != "" {
		if r, err := strconv.Atoi(voterRoleStr); err == nil {
			if RoleType(r) == RoleExpert {
				weight = 2
			}
		}
	}

	// 更新投票数
	vote.TotalVotes += weight
	if voteType == 1 {
		vote.ApproveVotes += weight
	} else {
		vote.RejectVotes += weight
	}

	// 保存更新后的投票信息
	newVoteBytes, err := json.Marshal(vote)
	if err != nil {
		return shim.Error("marshal new vote failed: " + err.Error())
	}
	err = stub.PutStateFromKeyByte(voteKey, newVoteBytes)
	if err != nil {
		return shim.Error("update vote failed: " + err.Error())
	}

	// 标记已投票
	votedMap[voter] = true
	newVotedBytes, err := json.Marshal(votedMap)
	if err != nil {
		return shim.Error("marshal voted map failed: " + err.Error())
	}
	err = stub.PutStateFromKeyByte(votedKey, newVotedBytes)
	if err != nil {
		return shim.Error("update voted map failed: " + err.Error())
	}

	// 发送事件
	stub.EmitEvent("VoteCast", []string{verifyID, voter, voteTypeStr, strconv.FormatInt(weight, 10)})

	stub.Log("[castVote] success, verifyID: " + verifyID + ", voter: " + voter)
	return shim.Success([]byte("cast vote success"))
}

// JudgeVerificationResult 判定验证结果
func (kc *KnowledgeContract) JudgeVerificationResult(stub shim.CMStubInterface) protogo.Response {
	params := stub.GetArgs()
	verifyID := string(params["verify_id"])
	currentTimeStr := string(params["current_time_ms"]) // 调用方提供当前时间（ms）

	if verifyID == "" || currentTimeStr == "" {
		return shim.Error("params error: verify_id/current_time_ms must not empty")
	}

	// 获取投票信息
	voteKey := "vote_" + verifyID
	voteBytes, err := stub.GetStateFromKeyByte(voteKey)
	if err != nil {
		return shim.Error("get vote info failed: " + err.Error())
	}
	if len(voteBytes) == 0 {
		return shim.Error("vote not found")
	}

	var vote VerificationVote
	err = json.Unmarshal(voteBytes, &vote)
	if err != nil {
		return shim.Error("unmarshal vote failed: " + err.Error())
	}

	// 检查投票是否结束（使用调用方提供的时间）
	currentTime, err := strconv.ParseInt(currentTimeStr, 10, 64)
	if err != nil {
		return shim.Error("params error: current_time_ms invalid")
	}
	if currentTime < vote.EndTime {
		return shim.Error("vote not finished yet")
	}

	// 获取关联的知识
	knowledgeKey := "knowledge_" + vote.KnowledgeID
	knowledgeBytes, err := stub.GetStateFromKeyByte(knowledgeKey)
	if err != nil {
		return shim.Error("get knowledge failed: " + err.Error())
	}
	if len(knowledgeBytes) == 0 {
		return shim.Error("knowledge not found")
	}

	var knowledge Knowledge
	err = json.Unmarshal(knowledgeBytes, &knowledge)
	if err != nil {
		return shim.Error("unmarshal knowledge failed: " + err.Error())
	}

	// 计算投票比例（阈值：同意加权比例 > 70% 则通过，其他情况均拒绝）
	var newStatus KnowledgeStatus
	approveRatio := float64(0)
	if vote.TotalVotes > 0 {
		approveRatio = float64(vote.ApproveVotes) / float64(vote.TotalVotes)
	}

	if approveRatio >= 0.7 {
		newStatus = StatusApproved
	} else {
		// 同意加权比例未超过 70%，或者没有人投票，均视为拒绝
		newStatus = StatusRejected
	}

	// 更新知识状态
	knowledge.Status = newStatus
	newKnowledgeBytes, err := json.Marshal(knowledge)
	if err != nil {
		return shim.Error("marshal new knowledge failed: " + err.Error())
	}
	err = stub.PutStateFromKeyByte(knowledgeKey, newKnowledgeBytes)
	if err != nil {
		return shim.Error("update knowledge status failed: " + err.Error())
	}

	// 发送事件
	if newStatus == StatusApproved {
		stub.EmitEvent("KnowledgeVerified", []string{vote.KnowledgeID, strconv.FormatFloat(approveRatio, 'f', 2, 64)})
	} else if newStatus == StatusRejected {
		stub.EmitEvent("KnowledgeRejected", []string{vote.KnowledgeID, strconv.FormatFloat(approveRatio, 'f', 2, 64)})
	}

	stub.Log("[judgeVerificationResult] success, knowledgeID: " + vote.KnowledgeID + ", status: " + strconv.Itoa(int(newStatus)))
	return shim.Success([]byte("judge success, knowledge status: " + strconv.Itoa(int(newStatus))))
}


// ========== 辅助方法 ==========
// isAdminRole 根据传入的角色字符串判断是否为管理员（角色由业务侧传入）
func (kc *KnowledgeContract) isAdminRole(roleStr string) bool {
	if roleStr == "" {
		return false
	}
	r, err := strconv.Atoi(roleStr)
	if err != nil {
		return false
	}
	return RoleType(r) == RoleAdmin
}

// main 合约入口
func main() {
	err := shim.Start(new(KnowledgeContract))
	if err != nil {
		log.Fatal("start contract failed: ", err)
	}
}
