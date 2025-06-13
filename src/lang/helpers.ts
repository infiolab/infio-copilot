//Solution copied from obsidian-kanban: https://github.com/mgmeyers/obsidian-kanban/blob/44118e25661bff9ebfe54f71ae33805dc88ffa53/src/lang/helpers.ts

import { moment } from "obsidian";

import ar from "./locale/ar";
import cz from "./locale/cz";
import da from "./locale/da";
import de from "./locale/de";
import en from "./locale/en";
import enGB from "./locale/en-gb";
import es from "./locale/es";
import fr from "./locale/fr";
import hi from "./locale/hi";
import hu from "./locale/hu";
import id from "./locale/id";
import it from "./locale/it";
import ja from "./locale/ja";
import ko from "./locale/ko";
import nl from "./locale/nl";
import no from "./locale/no";
import pl from "./locale/pl";
import pt from "./locale/pt";
import ptBR from "./locale/pt-br";
import ro from "./locale/ro";
import ru from "./locale/ru";
import tr from "./locale/tr";
import zhCN from "./locale/zh-cn";
import zhTW from "./locale/zh-tw";

const localeMap: { [k: string]: Partial<typeof en> } = {
	en,
	ar,
	cs: cz,
	da,
	de,
	"en-gb": enGB,
	es,
	fr,
	hi,
	id,
	it,
	ja,
	ko,
	nl,
	nn: no,
	pl,
	pt,
	"pt-br": ptBR,
	ro,
	ru,
	tr,
	"zh-cn": zhCN,
	"zh-tw": zhTW,
	hu,
};

const locale = localeMap[moment.locale()];

export function t(str: string, params?: Record<string, any>): any {
	if (!locale) {
		console.error({
			plugin: "infio-copilot",
			fn: t,
			where: "src/lang/helpers.ts",
			message: "Error: locale not found",
			data: moment.locale(),
		});
	}

	const path = str.split('.');
	let result: any = locale || en;

	for (const key of path) {
		result = result[key] || (en && en[key]);
		if (result === undefined) return str;
	}

	// Handle parameter interpolation
	if (params && typeof result === 'string') {
		return result.replace(/\{([^}]+)\}/g, (match, key) => {
			return params[key] !== undefined ? String(params[key]) : match;
		});
	}

	return result;
}
