/**
 * The error thrown by the v1 (REST) Nexus Mods API client.
 *
 * This lived in types/util.ts, a grab-bag that also holds GameListCache - which calls
 * `other.Games()` from api/queries/all.ts, which imports api/queries/v1.ts, which needed
 * this class. Importing one error therefore dragged the whole query layer in behind it
 * and closed a runtime import cycle. The class has no dependencies of its own, so it
 * belongs on its own.
 *
 * It takes a status code rather than a client's error object. It used to take an
 * AxiosError and read `error.response?.status` off it, which tied a message-mapping
 * table to whichever HTTP library the caller happened to use - and the commented-out
 * `raw: Response` field below is the fingerprint of the last time that binding changed.
 * A number is what it actually needs.
 */
export class NexusAPIServerError implements Error {
    public code: number = -1;
    public name: string = 'Unknown Error';
    public message: string = 'An unknown network error occurred when communicating with the API.';
    public path?: string = undefined;
    public authType?: string = undefined;

    constructor(status: number | undefined, authType: 'OAUTH', path?: string) {
        this.code = status ?? -1;
        this.path = path;
        this.authType = authType;
        const errorType: string | undefined = this.code > 0 ? this.code.toString()[0] : undefined;

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
            // Unauthorised. `else if`, not `if`: the 400 branch above used to fall
            // through into this chain, miss 401 and 404, and land in the generic else -
            // so a 400 was relabelled 'Client Error' the moment after it was labelled
            // 'Bad Request'.
            else if (this.code === 401) {
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
