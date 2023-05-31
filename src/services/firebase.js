import { firebase, FieldValue, storage } from "../lib/firebase";

export async function doesUsernameExist(username) {
	const result = await firebase
		.firestore()
		.collection("users")
		.where("username", "==", username)
		.get();

	return result.docs.map((user) => user.data.length > 0);
}

export async function getUserByUsername(username) {
	const result = await firebase
		.firestore()
		.collection("users")
		.where("username", "==", username)
		.get();

	return result.docs.map((user) => ({
		...user.data(),
		docId: user.id,
	}));
}

export async function getUserByUserId(userId) {
	const result = await firebase
		.firestore()
		.collection("users")
		.where("userId", "==", userId)
		.get();

	const user = result.docs.map((item) => ({
		...item.data(),
		docId: item.id,
	}));

	return user;
}

export async function getSuggestedProfiles(userId, following) {
	const result = await firebase.firestore().collection("users").limit(20).get();

	const user = result.docs
		.map((item) => ({
			...item.data(),
			docId: item.id,
		}))
		.filter(
			(profile) =>
				profile.userId !== userId && !following.includes(profile.userId)
		);

	return user;
}

export async function updateLoggedInUserFollowing(
	loggedInUserDocId,
	profileId,
	isFollowingProfile
) {
	firebase
		.firestore()
		.collection("users")
		.doc(loggedInUserDocId)
		.update({
			following: isFollowingProfile
				? FieldValue.arrayRemove(profileId)
				: FieldValue.arrayUnion(profileId),
		});
}

export async function updateFollowedUserFollowers(
	userDocId,
	loggedInUserId,
	isFollowingProfile
) {
	firebase
		.firestore()
		.collection("users")
		.doc(userDocId)
		.update({
			followers: isFollowingProfile
				? FieldValue.arrayRemove(loggedInUserId)
				: FieldValue.arrayUnion(loggedInUserId),
		});
}

export async function getPhotos(userId, following) {
	const result = await firebase
		.firestore()
		.collection("photos")
		.where("userId", "in", following)
		.get();

	const photosOfUserFollowed = result.docs.map((photo) => ({
		...photo.data(),
		docId: photo.id,
	}));

	const photosWithUserDetails = await Promise.all(
		photosOfUserFollowed.map(async (photo) => {
			let userLikedPhotos = false;
			if (photo.likes.includes(userId)) {
				userLikedPhotos = true;
			}
			const user = await getUserByUserId(photo.userId);
			const { username } = user[0];

			return { username, ...photo, userLikedPhotos };
		})
	);

	return photosWithUserDetails;
}

export async function getUserPhotosByUsername(username) {
	const [user] = await getUserByUsername(username);
	const result = await firebase
		.firestore()
		.collection("photos")
		.where("userId", "==", user.userId)
		.get();

	return result.docs.map((item) => ({
		...item.data(),
		docId: item.id,
	}));
}

export async function isUserFollowingProfile(
	loggedInUserUsername,
	profileUserId
) {
	const result = await firebase
		.firestore()
		.collection("users")
		.where("username", "==", loggedInUserUsername)
		.where("following", "array-contains", profileUserId)
		.get();

	const [response = {}] = result.docs.map((item) => ({
		...item.data(),
		docId: item.id,
	}));

	return response.userId;
}

export async function toggleFollow(
	isFollowingProfile,
	activeUserDocId,
	profileDocId,
	profileUserId,
	followingUserId
) {
	await updateLoggedInUserFollowing(
		activeUserDocId,
		profileUserId,
		isFollowingProfile
	);

	await updateFollowedUserFollowers(
		profileDocId,
		followingUserId,
		isFollowingProfile
	);
}

export async function getToMessageUsers(followers = [], following = []) {
	let result = [];

	if (followers.length > 0 && following.length > 0) {
		result = await firebase
			.firestore()
			.collection("users")
			.where("userId", "in", following)
			.get();

		let arr = result.docs?.map((item) => ({
			...item.data(),
			docId: item.id,
		}));

		const result2 = await firebase
			.firestore()
			.collection("users")
			.where("userId", "in", followers)
			.get();

		arr = [
			...arr,
			...result2.docs?.map((item) => ({
				...item.data(),
				docId: item.id,
			})),
		];

		const set = new Set();

		let finalAns = arr.filter((el) => {
			if (!set.has(el.userId)) {
				set.add(el.userId);
				return el;
			}
			return false;
		});

		return finalAns;
	} else if (following.length === 0 && followers.length > 0) {
		result = await firebase
			.firestore()
			.collection("users")
			.where("userId", "in", followers)
			.get();
	} else if (followers.length === 0 && following.length > 0) {
		result = await firebase
			.firestore()
			.collection("users")
			.where("userId", "in", following)
			.get();
	}
	const response = result.docs?.map((item) => ({
		...item.data(),
		docId: item.id,
	}));

	return response;
}

export async function addPostToPhotos(userId, url, caption) {
	const lenResult = await firebase.firestore().collection("photos").get();
	const lastId = lenResult.docs.length;

	console.log("lastId is", lastId);

	await firebase
		.firestore()
		.collection("photos")
		.add({
			photoId: lastId + 1,
			userId: userId,
			imageSrc: url,
			caption: caption,
			likes: [],
			comments: [],
			userLatitude: "40.7128°",
			userLongitude: "74.0060°",
			dateCreated: Date.now(),
		});
}

export const uploadPostImage = async (userId, username, file, caption) => {
	const { items } = await storage.ref(`images/users/${username}/`).listAll();
	const photoNumber = items.length + 1;
	console.log(photoNumber);

	const uploadTask = storage
		.ref(`images/users/${username}/${photoNumber}.png`)
		.put(file);

	uploadTask.on(
		"state_changed",
		(snapshot) => {},
		(error) => console.log(error),
		async () => {
			//get the number of items in the folder

			const imageUrl = await storage
				.ref(`images/users/${username}/`)
				.child(`${photoNumber}.png`)
				.getDownloadURL();

			console.log("imageUrl is", imageUrl);

			await addPostToPhotos(userId, imageUrl, caption);
		}
	);
};
