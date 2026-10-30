import { getPool } from '../backend/src/db';
import { ensurePostgresRunning } from '../backend/src/db/embedded-helper';

async function main() {
  await ensurePostgresRunning();
  const pool = getPool();

  const query = `
    SELECT 
      v.platform_video_id,
      v.platform,
      sr.match_score,
      COALESCE(sr.score_breakdown->>'evidence', 'thumbnail') as evidence,
      sr.explanation
    FROM search_results sr
    JOIN videos v ON v.id = sr.video_id
    ORDER BY sr.id DESC
    LIMIT 6;
  `;

  const res = await pool.query(query);
  console.log('--- GENUINE DB ROWS ---');
  console.log(JSON.stringify(res.rows, null, 2));
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
