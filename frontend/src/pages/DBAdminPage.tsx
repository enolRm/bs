import React, { useEffect, useState } from "react";
import { dbAdminApi } from "../api";

export const DBAdminPage: React.FC = () => {
  const [tables, setTables] = useState<string[]>([]);
  const [selectedTable, setSelectedTable] = useState<string>("");
  const [tableData, setTableData] = useState<any[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [editingRow, setEditingRow] = useState<any | null>(null);
  const [editValues, setEditValues] = useState<any>({});

  useEffect(() => {
    loadTables();
  }, []);

  useEffect(() => {
    if (selectedTable) {
      loadTableData(selectedTable, page);
    }
  }, [selectedTable, page]);

  const loadTables = async () => {
    try {
      const data = await dbAdminApi.listTables();
      setTables(data);
      if (data.length > 0) {
        setSelectedTable(data[0]);
      }
    } catch (error) {
      console.error("加载表列表失败:", error);
    }
  };

  const loadTableData = async (tableName: string, p: number) => {
    setLoading(true);
    try {
      const result = await dbAdminApi.getTableData(tableName, p);
      setTableData(result.data);
      setColumns(result.columns);
      setTotalCount(result.total_count);
    } catch (error) {
      console.error("加载表数据失败:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (rowId: number) => {
    if (!window.confirm("确定要删除这一行吗？")) return;
    try {
      await dbAdminApi.deleteRow(selectedTable, rowId);
      loadTableData(selectedTable, page);
    } catch (error) {
      alert("删除失败");
    }
  };

  const handleEdit = (row: any) => {
    setEditingRow(row);
    setEditValues({ ...row });
  };

  const handleSave = async () => {
    try {
      await dbAdminApi.updateRow(selectedTable, editingRow.id, editValues);
      setEditingRow(null);
      loadTableData(selectedTable, page);
    } catch (error) {
      alert("保存失败");
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>, col: string) => {
    setEditValues({
      ...editValues,
      [col]: e.target.value,
    });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900 flex items-center">
          本地数据库管理
          <span className="ml-3 px-2 py-1 bg-yellow-100 text-yellow-800 text-xs font-medium rounded border border-yellow-200">
            演示用
          </span>
        </h2>
        <div className="flex items-center space-x-4">
          <label className="text-sm font-medium text-gray-700 whitespace-nowrap">选择表:</label>
          <select
            value={selectedTable}
            onChange={(e) => {
              setSelectedTable(e.target.value);
              setPage(1);
            }}
            className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm rounded-md"
          >
            {tables.map((table) => (
              <option key={table} value={table}>
                {table}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="bg-white shadow overflow-hidden border-b border-gray-200 sm:rounded-lg">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {columns.map((col) => (
                  <th
                    key={col}
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    {col}
                  </th>
                ))}
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={columns.length + 1} className="px-6 py-4 text-center text-sm text-gray-500">
                    加载中...
                  </td>
                </tr>
              ) : tableData.length === 0 ? (
                <tr>
                  <td colSpan={columns.length + 1} className="px-6 py-4 text-center text-sm text-gray-500">
                    无数据
                  </td>
                </tr>
              ) : (
                tableData.map((row, idx) => (
                  <tr key={row.id || idx}>
                    {columns.map((col) => (
                      <td key={col} className="px-6 py-4 text-sm text-gray-900 max-w-xs truncate">
                        {editingRow && editingRow.id === row.id ? (
                          col === "id" ? (
                            row[col]
                          ) : (
                            <input
                              type="text"
                              value={editValues[col] || ""}
                              onChange={(e) => handleInputChange(e, col)}
                              className="w-full px-2 py-1 border rounded focus:ring-primary-500 focus:border-primary-500"
                            />
                          )
                        ) : (
                          String(row[col])
                        )}
                      </td>
                    ))}
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      {editingRow && editingRow.id === row.id ? (
                        <>
                          <button
                            onClick={handleSave}
                            className="text-primary-600 hover:text-primary-900 mr-3"
                          >
                            保存
                          </button>
                          <button
                            onClick={() => setEditingRow(null)}
                            className="text-gray-600 hover:text-gray-900"
                          >
                            取消
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => handleEdit(row)}
                            className="text-primary-600 hover:text-primary-900 mr-3"
                          >
                            编辑
                          </button>
                          <button
                            onClick={() => handleDelete(row.id)}
                            className="text-red-600 hover:text-red-900"
                          >
                            删除
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <div className="text-sm text-gray-700">
          共 <span className="font-medium">{totalCount}</span> 条数据
        </div>
        <div className="flex space-x-2">
          <button
            disabled={page === 1}
            onClick={() => setPage(page - 1)}
            className="px-3 py-1 border rounded text-sm disabled:opacity-50 hover:bg-gray-50"
          >
            上一页
          </button>
          <span className="px-3 py-1 text-sm">
            第 {page} 页
          </span>
          <button
            disabled={page * 20 >= totalCount}
            onClick={() => setPage(page + 1)}
            className="px-3 py-1 border rounded text-sm disabled:opacity-50 hover:bg-gray-50"
          >
            下一页
          </button>
        </div>
      </div>
    </div>
  );
};
