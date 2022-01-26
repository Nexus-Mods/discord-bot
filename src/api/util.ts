export const logMessage  = (msg: string, obj?: object, error?: boolean) => {
    const message = `${new Date().toLocaleString()} -${msg}`;
    error === true ? console.error(message, obj) : console.log(message, obj);
};