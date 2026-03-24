#!/usr/bin/env node
/**
 * 软件授权码生成器（独立注册机）。
 * 用法示例：
 * node license-generator/license-generator.cjs --machine=ABC123 --days=365 --maxTasks=100 --features=TASK_MANAGEMENT,FLOW_DESIGN,TASK_EXECUTION,DEBUG --customer=客户A
 */
const crypto = require('crypto');

/**
 * 解析命令行参数。
 */
function parseArgs(argv) {
  const result = {};
  for (const raw of argv) {
    if (!raw.startsWith('--')) {
      continue;
    }
    const [k, ...rest] = raw.slice(2).split('=');
    result[k] = normalizeArgValue(rest.join('='));
  }
  return result;
}

/**
 * 规范化参数值，移除首尾引号与空白。
 */
function normalizeArgValue(value) {
  const trimmed = String(value ?? '').trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

/**
 * 执行 HMAC-SHA256 签名。
 */
function signHmac(payload, secret) {
  return crypto
    .createHmac('sha256', secret)
    .update(payload, 'utf8')
    .digest();
}

/**
 * Base64URL 编码。
 */
function toBase64Url(input) {
  return Buffer.from(input).toString('base64url');
}

/**
 * 构建授权负载对象。
 */
function buildPayload(options) {
  const now = Math.floor(Date.now() / 1000);
  const days = Number(options.days || 365);
  const codeValidHours = Number(options.codeValidHours || 24);
  const maxTasks = Number(options.maxTasks || 100);
  const machineCode = (options.machine || '*').trim().toUpperCase();
  const features = String(options.features || 'TASK_MANAGEMENT,FLOW_DESIGN,TASK_EXECUTION,DEBUG')
    .split(',')
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);

  if (!days || days <= 0) {
    throw new Error('--days 必须是正整数');
  }
  if (!maxTasks || maxTasks <= 0) {
    throw new Error('--maxTasks 必须是正整数');
  }
  if (!codeValidHours || codeValidHours <= 0) {
    throw new Error('--codeValidHours 必须是正整数');
  }
  if (features.length === 0) {
    throw new Error('--features 不能为空');
  }

  return {
    v: 1,
    customer: options.customer || 'UNKNOWN',
    machineCode,
    expireAt: now + days * 24 * 60 * 60,
    codeExpireAt: now + codeValidHours * 60 * 60,
    maxTasks,
    features,
    issuedAt: now,
  };
}

/**
 * 生成最终授权码（payload.signature）。
 */
function generateLicenseCode(payload, secret) {
  const payloadJson = JSON.stringify(payload);
  const payloadPart = toBase64Url(payloadJson);
  const signPart = toBase64Url(signHmac(payloadJson, secret));
  return `${payloadPart}.${signPart}`;
}

/**
 * 程序主入口。
 */
function main() {
  const args = parseArgs(process.argv.slice(2));
  const secret = args.secret || process.env.LICENSE_SECRET || 'IOT-LICENSE-SECRET-CHANGE-ME';
  const payload = buildPayload(args);
  const licenseCode = generateLicenseCode(payload, secret);

  console.log('=== 授权负载 ===');
  console.log(JSON.stringify(payload, null, 2));
  console.log('\n=== 授权码 ===');
  console.log(licenseCode);
}

main();
