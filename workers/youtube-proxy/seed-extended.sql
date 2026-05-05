-- Seed para as metas financeiras do ano de 2026
INSERT OR REPLACE INTO financial_goals (id, target_revenue) VALUES 
('2026-01', 10000.0),
('2026-02', 12000.0),
('2026-03', 15000.0),
('2026-04', 15000.0),
('2026-05', 20000.0);

-- Seed para transações de 2026 (Faturamento real)
INSERT OR REPLACE INTO transactions (id, date, type, amount, description, category) VALUES 
('t1', '2026-05-01', 'income', 5000.0, 'Consultoria PartnerHub', 'Consulting'),
('t2', '2026-05-02', 'income', 3500.0, 'Mentoria Escala 10X', 'Mentorship'),
('t3', '2026-05-03', 'income', 4500.0, 'Desenvolvimento Landing Page', 'Development'),
('t4', '2026-05-04', 'expense', 1200.0, 'Infraestrutura Cloud e APIs', 'Infrastructure'),
('t5', '2026-05-05', 'income', 2000.0, 'Suporte Mensal PartnerHub', 'Support');

-- Seed para histórico do Instagram (Crescimento de seguidores e alcance)
INSERT OR REPLACE INTO instagram_history (date, followers, reach, profile_views) VALUES 
('2026-01-01', 5200, 15000, 1200),
('2026-02-01', 5800, 18000, 1500),
('2026-03-01', 6400, 24000, 1900),
('2026-04-01', 7100, 31000, 2400),
('2026-05-01', 7850, 42000, 3100);

-- Seed para histórico de anúncios do Meta Ads (Leads vs Investimento)
INSERT OR REPLACE INTO meta_history (date, spend, leads, cpl) VALUES 
('2026-01-01', 1500.0, 150, 10.0),
('2026-02-01', 1800.0, 200, 9.0),
('2026-03-01', 2500.0, 312, 8.01),
('2026-04-01', 3500.0, 450, 7.78),
('2026-05-01', 4200.0, 580, 7.24);
