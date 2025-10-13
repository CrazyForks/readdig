import { eq, and, inArray } from 'drizzle-orm';

import { db } from '../db';
import { articles } from '../db/schema';
import computeHash from './hash';

// upsertManyPosts at once at super speed
export const upsertManyPosts = async (publicationId, newPosts) => {
	if (!newPosts || newPosts.length === 0) {
		return 0;
	}

	// step 0: get fingerprint the existing objects in database
	const fingerprints = newPosts.map((p) => p.fingerprint).filter((f) => f);
	let existingFingerprints = [];

	if (fingerprints.length > 0) {
		const existingFingerprintPosts = await db
			.select({ fingerprint: articles.fingerprint })
			.from(articles)
			.where(
				and(
					eq(articles.feedId, publicationId),
					inArray(articles.fingerprint, fingerprints),
				),
			);
		existingFingerprints = existingFingerprintPosts.map((p) => p.fingerprint);
	}

	const usePosts = newPosts.filter((p) => !existingFingerprints.includes(p.fingerprint));

	// step 1: get guid the existing objects in database
	const guids = usePosts.map((p) => p.guid).filter((g) => g);
	let existingPostsMap = {};

	if (guids.length > 0) {
		const existingPosts = await db
			.select()
			.from(articles)
			.where(and(eq(articles.feedId, publicationId), inArray(articles.guid, guids)));

		for (const post of existingPosts) {
			const hash = computeHash(post.guid);
			existingPostsMap[hash] = post;
		}
	}

	// step 2: separate posts into insert and update operations
	const insertOperations = [];
	const updateOperations = [];

	for (let i = usePosts.length - 1; i >= 0; i--) {
		const post = usePosts[i];
		if (!post.feedId) {
			throw new Error(`You forgot to specify the feedId field`);
		}

		const data = {
			...post,
			feedId: post.feedId || publicationId,
		};

		const hash = computeHash(post.guid);
		if (hash in existingPostsMap) {
			const existing = existingPostsMap[hash];
			if (post.fingerprint === existing.fingerprint) {
				continue;
			}

			updateOperations.push({
				where: and(eq(articles.id, existing.id), eq(articles.feedId, publicationId)),
				data: data,
			});
		} else {
			insertOperations.push(data);
		}
	}

	// step 3: execute operations

	if (insertOperations.length > 0) {
		await db.insert(articles).values(insertOperations);
	}

	for (const operation of updateOperations) {
		await db.update(articles).set(operation.data).where(operation.where);
	}

	return insertOperations.length + updateOperations.length;
};
