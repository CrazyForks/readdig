import { eq, like, asc, and, sql, or, count, isNotNull } from 'drizzle-orm';

import { db } from '../db';
import { lower } from '../db/lower';
import { folders, follows, feeds, articles } from '../db/schema';
import { isFeedType } from '../utils/feed';

const buildConditions = ({ userId, folderId, searchText, type, status }) => {
	const conditions = [];

	if (userId) {
		conditions.push(eq(follows.userId, userId));
	}

	if (folderId === null) {
		conditions.push(sql`${follows.folderId} IS NULL`);
	} else if (folderId) {
		conditions.push(isNotNull(follows.folderId));
		conditions.push(eq(follows.folderId, folderId));
	} else {
		conditions.push(isNotNull(follows.folderId));
	}

	if (searchText) {
		const searchConditions = [
			like(lower(follows.alias), `%${searchText.toLowerCase()}%`),
			like(lower(feeds.title), `%${searchText.toLowerCase()}%`),
		];

		if (folderId === undefined) {
			searchConditions.unshift(
				like(lower(folders.name), `%${searchText.toLowerCase()}%`),
			);
		}

		conditions.push(or(...searchConditions));
	}

	if (isFeedType(type)) {
		conditions.push(eq(feeds.type, type));
	}

	if (status) {
		if (status === 'active') {
			conditions.push(eq(feeds.valid, true));
		} else if (status === 'inactive') {
			conditions.push(eq(feeds.valid, false));
		} else if (status === 'failure') {
			conditions.push(sql`${feeds.consecutiveScrapeFailures} > 0`);
		}
	}

	return conditions;
};

exports.list = async (req, res) => {
	const userId = req.user.sub;
	const query = req.query || {};
	const searchText = decodeURIComponent(query.name || '').trim();

	// Build subquery for feed data with article counts
	const feedSubqueryConditions = buildConditions({
		userId,
		folderId: query.folderId,
		searchText,
		type: query.type,
		status: query.status,
	});

	// Create subquery with article counts
	const feedsWithCounts = db.$with('feeds_with_counts').as(
		db
			.select({
				id: feeds.id,
				folderId: follows.folderId,
				primary: follows.primary,
				fullText: follows.fullText,
				alias: follows.alias,
				title:
					sql`CASE WHEN ${follows.alias} IS NOT NULL THEN ${follows.alias} ELSE ${feeds.title} END`.as(
						'title',
					),
				url: feeds.url,
				type: feeds.type,
				valid: feeds.valid,
				postCount: count(articles.id).as('post_count'),
			})
			.from(follows)
			.innerJoin(feeds, eq(follows.feedId, feeds.id))
			.innerJoin(folders, eq(follows.folderId, folders.id))
			.leftJoin(articles, eq(articles.feedId, feeds.id))
			.where(and(...feedSubqueryConditions))
			.groupBy(
				feeds.id,
				follows.folderId,
				follows.primary,
				follows.fullText,
				follows.alias,
				feeds.title,
			),
	);

	// Use CTE with json_agg for aggregation
	const result = await db
		.with(feedsWithCounts)
		.select({
			id: folders.id,
			name: folders.name,
			icon: folders.icon,
			follows: sql`COALESCE(
				json_agg(
					json_build_object(
						'id', ${feedsWithCounts.id},
						'folderId', ${feedsWithCounts.folderId},
						'primary', ${feedsWithCounts.primary},
						'fullText', ${feedsWithCounts.fullText},
						'alias', ${feedsWithCounts.alias},
						'title', ${feedsWithCounts.title},
						'url', ${feedsWithCounts.url},
						'type', ${feedsWithCounts.type},
						'valid', ${feedsWithCounts.valid},
						'postCount', ${feedsWithCounts.postCount}
					)
					ORDER BY ${feedsWithCounts.title} ASC
				) FILTER (WHERE ${feedsWithCounts.id} IS NOT NULL),
				'[]'::json
			)`,
		})
		.from(folders)
		.leftJoin(feedsWithCounts, eq(feedsWithCounts.folderId, folders.id))
		.where(
			and(
				eq(folders.userId, userId),
				query.folderId ? eq(folders.id, query.folderId) : undefined,
			),
		)
		.groupBy(folders.id, folders.name, folders.icon)
		.having(
			sql`json_array_length(COALESCE(json_agg(${feedsWithCounts.id}) FILTER (WHERE ${feedsWithCounts.id} IS NOT NULL), '[]'::json)) > 0`,
		)
		.orderBy(asc(folders.name));

	if (!query.folderId) {
		const noFolderWhereConditions = buildConditions({
			userId,
			folderId: null,
			searchText,
			type: query.type,
			status: query.status,
		});

		const noFolderFollows = await db
			.select({
				id: feeds.id,
				folderId: follows.folderId,
				primary: follows.primary,
				fullText: follows.fullText,
				alias: follows.alias,
				title: sql`CASE WHEN ${follows.alias} IS NOT NULL THEN ${follows.alias} ELSE ${feeds.title} END`,
				url: feeds.url,
				type: feeds.type,
				valid: feeds.valid,
				postCount: count(articles.id),
			})
			.from(follows)
			.innerJoin(feeds, eq(follows.feedId, feeds.id))
			.leftJoin(articles, eq(articles.feedId, feeds.id))
			.where(and(...noFolderWhereConditions))
			.groupBy(follows.id, feeds.id)
			.orderBy(
				asc(
					sql`CASE WHEN ${follows.alias} IS NOT NULL THEN ${follows.alias} ELSE ${feeds.title} END`,
				),
			);

		if (noFolderFollows.length > 0) {
			result.push({
				id: '0',
				name: 'UNGROUPED',
				follows: noFolderFollows,
			});
		}
	}

	res.json(result);
};
