/**
 * 将画布节点 config 转为 Ant Design Form 可用的 initialValues。
 * 后期新增节点时：在此函数中增加该类型的字段规范化，或拆到 normalizeXxx.js 再汇总。
 */

/**
 * @param {object|null|undefined} nodeData - 画布节点 data（含 config）
 * @param {string|undefined} type - 节点类型
 * @returns {Record<string, unknown>}
 */
export function buildNodeFormInitialValues(nodeData, type) {
  const rawCfg = nodeData?.config;
  let initialValues =
    rawCfg && typeof rawCfg === 'object' && !Array.isArray(rawCfg) ? { ...rawCfg } : {};
  if (!initialValues.name && type) {
    initialValues.name = type;
  }

  if (Array.isArray(initialValues.operations)) {
    initialValues.operations = initialValues.operations.map((op) => {
      if (!op || typeof op !== 'object') {
        return op;
      }
      return {
        ...op,
        paramsStr: op.params ? JSON.stringify(op.params) : undefined,
      };
    });
  }

  if (Array.isArray(initialValues.branches)) {
    initialValues.branches = initialValues.branches.map((branch) => {
      if (!branch || typeof branch !== 'object') {
        return branch;
      }
      const cond = branch.condition;
      if (cond && typeof cond === 'object' && cond.left !== undefined) {
        return {
          ...branch,
          condition: {
            ...cond,
            variable: cond.left,
            value: cond.right,
          },
        };
      }
      return branch;
    });
  }

  if (initialValues.params && Array.isArray(initialValues.params)) {
    initialValues.paramsList = initialValues.params;
  }

  if (type === 'PLC_WRITE') {
    normalizePlcWrite(initialValues);
  }
  if (type === 'PLC_READ') {
    normalizePlcRead(initialValues);
  }

  return initialValues;
}

/** 中文注释：PLC 写入 — host 与旧字段 ip 对齐；registers 多路；兼容单 address+writeValue */
function normalizePlcWrite(initialValues) {
  if (!Array.isArray(initialValues.registers) || initialValues.registers.length === 0) {
    if (initialValues.address != null || initialValues.writeValue != null) {
      initialValues.registers = [
        {
          address: initialValues.address,
          valueSource: initialValues.writeValue ?? '',
          writeAs: initialValues.writeAs || 'AUTO',
        },
      ];
    } else {
      initialValues.registers = [{ address: undefined, valueSource: '', writeAs: 'AUTO' }];
    }
  } else {
    initialValues.registers = initialValues.registers.map((row) =>
      row && typeof row === 'object' && !Array.isArray(row)
        ? {
            address: row.address,
            valueSource: row.valueSource != null ? row.valueSource : '',
            writeAs: row.writeAs || 'AUTO',
          }
        : { address: undefined, valueSource: '', writeAs: 'AUTO' }
    );
  }
  if (initialValues.host == null && initialValues.ip != null) {
    initialValues.host = initialValues.ip;
  }
}

/** 中文注释：PLC 读取 — reads 列表；纠正异常类型避免 Form.List 崩溃 */
function normalizePlcRead(initialValues) {
  if (!Array.isArray(initialValues.reads) || initialValues.reads.length === 0) {
    initialValues.reads = [{ address: undefined, quantity: 1 }];
  } else {
    initialValues.reads = initialValues.reads.map((row) =>
      row && typeof row === 'object' && !Array.isArray(row)
        ? { address: row.address, quantity: row.quantity != null ? row.quantity : 1 }
        : { address: undefined, quantity: 1 }
    );
  }
  if (initialValues.host == null && initialValues.ip != null) {
    initialValues.host = initialValues.ip;
  }
}
