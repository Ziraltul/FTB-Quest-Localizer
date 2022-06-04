import fs from "fs";
import inquirer from "inquirer";
import translate from "./modules/translate.js";
import langs from "./langs.js";

async function questExtract(chapterFile, modPackName, isTranslate, targetLang) {
  const chapter = chapterFile.replace(".snbt", "");
  const questChapter = fs
    .readFileSync(`./ftbquests/chapters/${chapterFile}`, "utf-8")
    .replaceAll('\\"', "'");

  !fs.existsSync("./output/chapters") &&
    fs.mkdirSync("./output/chapters", { recursive: true });

  let rewriteChapter = questChapter;
  let lang = {};
  let translatedLang = {};

  const titleRegex = /\btitle: \"[\s\S.]*?\"/gm;
  const subTitleRegex = /\bsubtitle: \[?\"[\s\S.]*?\"\]?/gm;
  const descRegex = /\bdescription: \[[\s\S.]*?\]/gm;

  const titles = questChapter.match(titleRegex);
  const subTitles = questChapter.match(subTitleRegex);
  const descriptions = questChapter.match(descRegex);

  if (!titles && !subTitles && !descriptions) return;

  function getString(text, part) {
    const stringRegex = /(?<=("))(?:(?=(\\?))\2.)*?(?=\1)/gm;
    return text
      .replace(`${part}: `, "")
      .toString()
      .replaceAll('""', "")
      .match(stringRegex);
  }

  function removeEmpty(array) {
    return array.filter((e) => e);
  }

  function convert(array, part) {
    return new Promise(async (resolve) => {
      const sourceStrings = removeEmpty(
        array.flatMap((el) => getString(el, `${part}`))
      );

      let translatedStrings;
      if (isTranslate) {
        translatedStrings = await Promise.all(
          sourceStrings.map((sourceString) => {
            return translate(sourceString, targetLang);
          })
        );
      }
      sourceStrings.map((sourceString, i) => {
        rewriteChapter = rewriteChapter.replace(
          `"${sourceString}"`,
          `"{${modPackName}.${chapter}.${part}${i}}"`
        );

        if (isTranslate) {
          const translatedString = translatedStrings[i];
          translatedLang = {
            ...translatedLang,
            [`${modPackName}.${chapter}.${part}${i}`]: translatedString,
          };
        }

        lang = {
          ...lang,
          [`${modPackName}.${chapter}.${part}${i}`]: sourceString,
        };
      });
      resolve();
    });
  }

  if (titles) {
    await convert(titles, "title");
  }
  if (subTitles) {
    await convert(subTitles, "subtitle");
  }
  if (descriptions) {
    await convert(descriptions, "description");
  }

  fs.writeFileSync(`./output/chapters/${chapterFile}`, rewriteChapter);

  if (fs.existsSync("./output/en_us.json")) {
    const langFile = fs.readFileSync(`./output/en_us.json`, "utf-8");
    lang = { ...lang, ...JSON.parse(langFile) };
    fs.writeFileSync(`./output/en_us.json`, JSON.stringify(lang, null, 2));
  } else {
    fs.writeFileSync(`./output/en_us.json`, JSON.stringify(lang, null, 2));
  }

  if (isTranslate) {
    if (fs.existsSync("./output/translated.json")) {
      const langFile = fs.readFileSync(`./output/translated.json`, "utf-8");
      translatedLang = { ...translatedLang, ...JSON.parse(langFile) };
      fs.writeFileSync(
        `./output/translated.json`,
        JSON.stringify(translatedLang, null, 2)
      );
    } else {
      fs.writeFileSync(
        `./output/translated.json`,
        JSON.stringify(translatedLang, null, 2)
      );
    }
  }
  console.log(`${chapterFile} done`);
}

function run(modPackName, isTranslate, targetLang) {
  fs.readdir(`./ftbquests/chapters`, function (err, fileLists) {
    if (err) {
      return console.error("'./ftbquests/chapters' directory not found");
    }
    fileLists.map((file) =>
      questExtract(file, modPackName, isTranslate, targetLang)
    );
  });
}

function prompt() {
  return inquirer.prompt([
    {
      name: "modPackName",
      message: `Enter the modpack name to display in the json key:`,
      type: "input",
      filter: (value) => {
        const valid = /[`~!@#$%^&*()_|+\-=?;:'",.<>\{\}\[\]\\\/ ]/gm;
        const result = value.replace(valid, "").toLowerCase();
        return result;
      },
    },
    {
      name: "isTranslate",
      message: "Do you want to output the machine translated files as well?",
      type: "confirm",
    },
    {
      name: "targetLang",
      message: "Enter target language (e.g. en, ko, es):",
      type: "input",
      when: (answers) => {
        if (answers.isTranslate === true) {
          return true;
        }
      },
      validate: (value) => {
        if (langs.includes(value)) {
          return true;
        } else {
          return "Language not supported";
        }
      },
    },
  ]);
}

(async () => {
  console.info(
    "Extracts text from chapter files to converts them for easy localization"
  );
  console.info(
    "The root directory must have the ftbquests directory to extract"
  );
  console.info("Output is created in the output directory");
  const answers = await prompt();
  run(answers.modPackName, answers.isTranslate, answers.targetLang);
})();