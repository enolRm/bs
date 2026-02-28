import base64
import json
import logging
from functools import lru_cache
from typing import Any, Dict

from tencentcloud.common import credential
from tencentcloud.common.exception.tencent_cloud_sdk_exception import TencentCloudSDKException
from tencentcloud.common.profile.client_profile import ClientProfile
from tencentcloud.common.profile.http_profile import HttpProfile
from tencentcloud.tbaas.v20180416 import models, tbaas_client

from .config import settings

logger = logging.getLogger(__name__)


class BlockchainClient:
    def __init__(self) -> None:
        if not settings.TBAAS_SECRET_ID or not settings.TBAAS_SECRET_KEY:
            raise RuntimeError("TBAAS_SECRET_ID or TBAAS_SECRET_KEY not configured.")

        cred = credential.Credential(settings.TBAAS_SECRET_ID, settings.TBAAS_SECRET_KEY)
        httpProfile = HttpProfile()
        httpProfile.endpoint = "tbaas.tencentcloudapi.com"
        clientProfile = ClientProfile()
        clientProfile.httpProfile = httpProfile
        self.client = tbaas_client.TbaasClient(cred, "ap-beijing", clientProfile)

    def _decode_result(self, result: str) -> str:
        if not result:
            return ""
        try:
            return base64.b64decode(result).decode("utf-8")
        except Exception as e:
            logger.error(f"Error decoding blockchain result: {e}, original result: {result}")
            return result

    def _invoke_contract(self, func_name: str, func_param: Dict[str, Any]) -> Any:
        try:
            req = models.InvokeChainMakerDemoContractRequest()
            req.ClusterId = settings.TBAAS_CLUSTER_ID
            req.ChainId = settings.TBAAS_CHAIN_ID
            req.ContractName = settings.TBAAS_CONTRACT_NAME
            req.FuncName = func_name
            req.FuncParam = json.dumps(func_param)

            resp = self.client.InvokeChainMakerDemoContract(req)
            req.AsyncFlag = 0 # 0为同步执行，1为异步执行
            return resp
        except TencentCloudSDKException as err:
            logger.error(f"TencentCloudSDKException: {err}")
            raise RuntimeError(f"TBAAS invocation failed: {err}") from err
        except Exception as e:
            logger.error(f"Error invoking contract: {e}")
            raise RuntimeError(f"Error invoking contract: {e}") from e

    def submit_knowledge(
        self,
        id: str,
        content_hash: str,
        source_credential: str,
        submitter: str,
        timestamp_ms: int,
        update_record_hash: str = "",
        vote_duration_ms: int = 0,
    ) -> str:
        func_param = {
            "id": id,
            "content_hash": content_hash,
            "source_credential": source_credential,
            "submitter": submitter,
            "timestamp_ms": str(timestamp_ms),
            "update_record_hash": update_record_hash,
        }
        if vote_duration_ms > 0:
            func_param["vote_duration_ms"] = str(vote_duration_ms)
        resp = self._invoke_contract("submitKnowledge", func_param)
        result = self._decode_result(resp.Result.Result)
        logger.info("提交知识上链成功, result: %s", result)
        return result

    def update_knowledge(
        self,
        id: str,
        new_content_hash: str,
        new_source_credential: str,
        operator: str,
        operator_role: str,
        new_update_record_hash: str,
        timestamp_ms: int,
        vote_duration_ms: int = 0,
    ) -> str:
        func_param = {
            "id": id,
            "new_content_hash": new_content_hash,
            "new_source_credential": new_source_credential,
            "operator": operator,
            "operator_role": operator_role,
            "new_update_record_hash": new_update_record_hash,
            "timestamp_ms": str(timestamp_ms),
        }
        if vote_duration_ms > 0:
            func_param["vote_duration_ms"] = str(vote_duration_ms)
        resp = self._invoke_contract("updateKnowledge", func_param)
        result = self._decode_result(resp.Result.Result)
        logger.info("更新知识上链成功, result: %s", result)
        return result

    def query_knowledge_by_id(self, id: str) -> str:
        func_param = {"id": id}
        resp = self._invoke_contract("queryKnowledgeById", func_param)
        result = self._decode_result(resp.Result.Result)
        logger.info("查询链上知识成功, result: %s", result)
        return result

    def query_knowledge_by_ids(self, ids: list[str]) -> list[Dict[str, Any]]:
        """批量查询链上知识"""
        if not ids:
            return []
        func_param = {"ids": ",".join(ids)}
        resp = self._invoke_contract("queryKnowledgeByIds", func_param)
        result_str = self._decode_result(resp.Result.Result)
        logger.info("批量查询链上知识成功")
        try:
            return json.loads(result_str)
        except json.JSONDecodeError:
            logger.error("解析批量查询结果失败: %s", result_str)
            return []

    def cast_vote(
        self,
        verify_id: str,
        voter: str,
        vote_type: int,  # 0: reject, 1: approve
        voter_role: int, # 0: normal, 1: expert, 2: admin
        current_time_ms: int,
    ) -> str:
        func_param = {
            "verify_id": verify_id,
            "voter": voter,
            "vote_type": str(vote_type),
            "voter_role": str(voter_role),
            "current_time_ms": str(current_time_ms),
        }
        resp = self._invoke_contract("castVote", func_param)
        result = self._decode_result(resp.Result.Result)
        logger.info("投票上链成功, result: %s", result)
        return result

    def judge_verification_result(
        self,
        verify_id: str,
        current_time_ms: int,
    ) -> str:
        func_param = {
            "verify_id": verify_id,
            "current_time_ms": str(current_time_ms),
        }
        resp = self._invoke_contract("judgeVerificationResult", func_param)
        result = self._decode_result(resp.Result.Result)
        logger.info("判断验证结果上链成功, result: %s", result)
        return result

@lru_cache
def get_blockchain_client() -> BlockchainClient:
    return BlockchainClient()
