import core from "./core";
import home from "./home";
import book from "./book";
import account from "./account";
import booking from "./booking";
import auth from "./auth";

export default { ...core, ...home, ...book, ...account, ...booking, ...auth } as Record<string, string>;
