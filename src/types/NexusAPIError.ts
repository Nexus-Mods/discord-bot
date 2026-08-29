import type { AxiosError } from 'axios';

/**
 * The error thrown by the v1 (REST) Nexus Mods API client.
 *
 * This lived in types/util.ts, a grab-bag that also holds GameListCache - which calls
 * `other.Games()` from api/queries/all.ts, which imports api/queries/v1.ts, which needed
 * this class. Importing one error therefore dragged the whole query layer in behind it
 * and closed a runtime import cycle. The class has no dependencies of its own beyond the
 * Axios error type, so it belongs on its own.
 */
export class NexusAPIServerError implements Error {
    public code: number = -1;
    public name: string = 'Unknown Error';
    public message: string = 'An unknown network error occurred when communicating with the API.';
    public path?: string = undefined;
    public authType?: string = undefined;
    // public raw: Response;

    constructor(error: AxiosError, authType: 'OAUTH', path?: string) {
        this.code = error.response?.status || -1;
        this.path = path;
        this.authType = authType;
        // this.raw = errorResponse;
        const errorType: string|undefined = error.response?.status.toString()[0];

        // Non-HTTP errors (possibly CloudFlare?)
        if (this.code > 599 || !errorType) return;

        // Server Error
        if (errorType === '5') {
            if (this.code === 504) {
                this.name = 'Request Timed Out'
                this.message = 'The request timed out before receiving a response from the server. This may be a temporary issue, please try again later.';
            }
            else {
                this.name = 'Internal Server Error'
                this.message = 'This may be a temporary issue, please try again later.';
            }
        }
        // Client Error
        else if (errorType === '4') {
            // Bad Request
            if (this.code === 400) {
                this.name = 'Bad Request';
                this.message = 'The request is invalid. This could be an issue with your account link, try unlinking and relinking.';
            }
            // Unauthorised
            if (this.code === 401) {
                this.name = 'Unauthorised';
                this.message = 'The API key or OAuth token for your account is not authorised to make this request. Please use the /link command to update it.';
            }
            // Not found
            else if (this.code === 404) {
                this.name = 'Not found';
                this.message = 'The resource you are looking for does not appear to exist. Please check your spelling.';
            }
            // Another 4XX error, which we don't cater for specifically. 
            else {
                this.name = 'Client Error';
                this.message = `There was an issue with the request which caused the error code ${this.code}.`;
            }
        }
        else if (errorType === '1' || errorType === '3') {
            // There's not really any reason to encounter the 1xx and 3xx codes so we'll just catch them here. 
            this.name = `Unexpected HTTP response ${this.code}`;
            this.message = 'The server responded with an unexpected HTTP code.';
        }

    }
};
