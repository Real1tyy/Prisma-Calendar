import { memo } from "react";

import type { DashboardItem, StatEntry } from "./dashboard-types";

const RANKING_LIMIT = 10;

interface DashboardRankingProps {
	items: DashboardItem[];
	stats: StatEntry[];
}

export const DashboardRanking = memo(function DashboardRanking({ items, stats }: DashboardRankingProps) {
	return (
		<>
			{stats.length > 0 && (
				<div className="prisma-dashboard-stats-grid">
					{stats.map((stat) => (
						<div
							key={stat.label}
							className="prisma-dashboard-stats-card"
							data-testid={`prisma-dashboard-stat-${stat.label}`}
						>
							<div className="prisma-dashboard-stats-value" data-testid={`prisma-dashboard-stat-value-${stat.label}`}>
								{String(stat.value)}
							</div>
							<div className="prisma-dashboard-stats-label">{stat.label}</div>
						</div>
					))}
				</div>
			)}

			{items.length === 0 ? <div className="prisma-dashboard-chart-empty">No data</div> : <RankingList items={items} />}
		</>
	);
});

const RankingList = memo(function RankingList({ items }: { items: DashboardItem[] }) {
	const sorted = [...items].sort((a, b) => b.count - a.count).slice(0, RANKING_LIMIT);
	const maxCount = sorted[0]?.count ?? 0;

	return (
		<div className="prisma-dashboard-ranking">
			{sorted.map((item, i) => {
				const pct = maxCount > 0 ? (item.count / maxCount) * 100 : 0;
				return (
					<div
						key={item.key}
						className="prisma-dashboard-ranking-row"
						data-testid={`prisma-dashboard-ranking-row-${item.title}`}
						data-item-title={item.title}
					>
						<span className="prisma-dashboard-ranking-pos">{i + 1}</span>
						<div className="prisma-dashboard-ranking-bar-wrap">
							<div
								className="prisma-dashboard-ranking-bar"
								style={{
									width: `${pct}%`,
									...(item.color ? { backgroundColor: item.color } : {}),
								}}
							/>
							<span className="prisma-dashboard-ranking-name">{item.title}</span>
						</div>
						<span className="prisma-dashboard-ranking-count">{item.count}</span>
					</div>
				);
			})}
		</div>
	);
});
