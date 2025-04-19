import { config } from './config/config';

export async function handle({ event, resolve }) {
	if (import.meta.env.PROD) {
		event.locals.base = config.baseURL;
		event.locals.analyticsID = config.analyticsID;
	} else {
		event.locals.base = '';
	}
	return resolve(event, {
		transformPageChunk: ({ html }) => {
			return html
				.replace('%baseURL%', event.locals.base)
				.replace('%analyticsID%', event.locals.analyticsID);
		}
	});
}