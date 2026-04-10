export const generateZettelId = (): number => {
	const currentTimestamp = new Date();
	const padWithZero = (number: number) => String(number).padStart(2, "0");
	return Number(
		`${currentTimestamp.getFullYear()}${padWithZero(currentTimestamp.getMonth() + 1)}${padWithZero(currentTimestamp.getDate())}${padWithZero(currentTimestamp.getHours())}${padWithZero(currentTimestamp.getMinutes())}${padWithZero(currentTimestamp.getSeconds())}`
	);
};
