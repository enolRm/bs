import json
from pathlib import Path
from typing import Any

from web3 import Web3

from .config import settings


class BlockchainClient:
    """简单封装 Web3 与 KnowledgeStorage 合约."""

    def __init__(self) -> None:
        self.w3 = Web3(Web3.HTTPProvider(settings.WEB3_RPC_URL))
        if not self.w3.is_connected():
            raise RuntimeError(f"无法连接到本地区块链节点: {settings.WEB3_RPC_URL}")

        if not settings.CONTRACT_ADDRESS:
            raise RuntimeError("CONTRACT_ADDRESS 未配置，请在 .env 中设置部署后的合约地址。")

        abi_path = Path(settings.CONTRACT_ABI_PATH)
        if not abi_path.exists():
            raise RuntimeError(f"找不到合约 ABI 文件: {abi_path}")

        with abi_path.open("r", encoding="utf-8") as f:
            artifact = json.load(f)

        abi = artifact.get("abi")
        if not abi:
            raise RuntimeError("ABI 文件中未找到 abi 字段。")

        self.contract = self.w3.eth.contract(
            address=settings.CONTRACT_ADDRESS,
            abi=abi,
        )

    def submit_knowledge(
        self,
        title: str,
        content_hash: str,
        source: str,
        from_address: str,
        private_key: str,
    ) -> int:
        """提交知识到链上，返回链上 id（同步交易，简化用法）."""
        nonce = self.w3.eth.get_transaction_count(from_address)

        tx = self.contract.functions.submitKnowledge(
            title,
            content_hash,
            source,
        ).build_transaction(
            {
                "from": from_address,
                "nonce": nonce,
                "gas": 500_000,
                "gasPrice": self.w3.eth.gas_price,
            }
        )

        signed_tx = self.w3.eth.account.sign_transaction(tx, private_key=private_key)
        tx_hash = self.w3.eth.send_raw_transaction(signed_tx.raw_transaction)
        receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash)

        # 解析事件，获取链上 id
        logs = self.contract.events.KnowledgeSubmitted().process_receipt(receipt)
        if not logs:
            raise RuntimeError("未在交易回执中找到 KnowledgeSubmitted 事件")

        event: Any = logs[0]["args"]
        return int(event["id"])

    def vote_knowledge(
        self,
        knowledge_id: int,
        support: bool,
        from_address: str,
        private_key: str,
    ) -> str:
        """对链上知识投票，返回交易哈希."""
        nonce = self.w3.eth.get_transaction_count(from_address)

        tx = self.contract.functions.voteKnowledge(
            knowledge_id,
            support,
        ).build_transaction(
            {
                "from": from_address,
                "nonce": nonce,
                "gas": 300_000,
                "gasPrice": self.w3.eth.gas_price,
            }
        )

        signed_tx = self.w3.eth.account.sign_transaction(tx, private_key=private_key)
        tx_hash = self.w3.eth.send_raw_transaction(signed_tx.raw_transaction)
        return tx_hash.hex()

    def finalize_knowledge(
        self,
        knowledge_id: int,
        from_address: str,
        private_key: str,
    ) -> str:
        """终局判定（finalize），返回交易哈希."""
        nonce = self.w3.eth.get_transaction_count(from_address)

        tx = self.contract.functions.finalizeKnowledge(knowledge_id).build_transaction(
            {
                "from": from_address,
                "nonce": nonce,
                "gas": 300_000,
                "gasPrice": self.w3.eth.gas_price,
            }
        )

        signed_tx = self.w3.eth.account.sign_transaction(tx, private_key=private_key)
        tx_hash = self.w3.eth.send_raw_transaction(signed_tx.raw_transaction)
        return tx_hash.hex()

    def get_knowledge_status(self, knowledge_id: int) -> int:
        """读取链上状态（0=Pending,1=Verified,2=Rejected）."""
        k = self.contract.functions.getKnowledge(knowledge_id).call()
        # struct Knowledge: (id,title,contentHash,source,submitter,createdAt,status)
        return int(k[6])


blockchain_client: BlockchainClient | None = None


def get_blockchain_client() -> BlockchainClient:
    global blockchain_client
    if blockchain_client is None:
        blockchain_client = BlockchainClient()
    return blockchain_client

