/**
 * BRAVO SQL Agent — Safety Sandbox & Query Guard
 * Ngăn chặn các câu lệnh nguy hiểm hoặc phá hoại hệ thống
 */

const FORBIDDEN_PATTERNS = [
  /\bDROP\s+DATABASE\b/i,
  /\bALTER\s+DATABASE\b/i,
  /\bSHUTDOWN\b/i,
  /\bxp_cmdshell\b/i,
  /\bsp_configure\b/i,
  /\bEXEC\s+xp_/i,
  /\bEXEC\s+sp_addlogin\b/i,
  /\bEXEC\s+sp_droplogin\b/i,
  /\bEXEC\s+sp_password\b/i
];

export function validateQuerySafety(sql) {
  if (!sql || typeof sql !== 'string') {
    return { safe: false, error: 'Câu lệnh truy vấn trống hoặc không hợp lệ.' };
  }

  const clean = sql.replace(/--.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

  for (const pattern of FORBIDDEN_PATTERNS) {
    if (pattern.test(clean)) {
      return {
        safe: false,
        error: `Phát hiện câu lệnh bị cấm vì lý do an toàn bảo mật: ${pattern.source.replace(/\\b/g, '')}`
      };
    }
  }

  const isReadOnly = !/\b(INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE|CREATE)\b/i.test(clean);

  return {
    safe: true,
    isReadOnly,
    cleanSql: clean
  };
}
