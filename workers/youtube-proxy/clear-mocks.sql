-- Limpar histórico de tráfego pago (Meta Ads) fictício
DELETE FROM meta_history;

-- Limpar registros de sementes mensais fictícias do Instagram para manter apenas os dados reais importados diariamente via API
DELETE FROM instagram_history WHERE date IN ('2026-01-01', '2026-02-01', '2026-03-01', '2026-04-01', '2026-05-01');

-- (Opcional) Limpar transações fictícias se necessário - descomente abaixo se quiser limpar o fluxo financeiro de teste:
-- DELETE FROM transactions;
-- DELETE FROM financial_goals;
