import * as JSZip from "jszip";
import { saveAs } from "file-saver";
import { fetchIgnoreCORS } from "./ioutil";

const downloadBtn = $(`<button class="ui labeled icon red button" id="download" type="button"><i class="cloud icon"></i>Download</button>`);
const getEmojiUrl = (emojiID, animated = false) => `https://cdn.discordapp.com/emojis/${emojiID}.${animated ? "gif" : "png"}?v=1`;
const getGuildIcon = (guild) => `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png`;

const API = {
    host: "https://discord.com/api/v10",
    emojis: (guild) => `/guilds/${guild}/emojis`,
    guilds: "/users/@me/guilds",
    guild: (id) => `/guilds/${id}`,
    request: async (method, endpoint, token) => {
        return await fetch(API.host + endpoint, {
            method,
            headers: {
                "Authorization": token
            }
        });
    }
};

const sortAlpha = (a, b) => {
    a = a.name.toLowerCase();
    b = b.name.toLowerCase();
    return a < b ? -1 : a > b ? 1 : 0
};

$(document).ready(function() {
    $("#minecraft-version").hide();
    $("#emojis").hide();

    $("#tokenHelp").click(() => {
        $('.ui.basic.modal').modal('show');
    });

    globalThis.guild = [];
    globalThis.emojis = [];
    globalThis.stickers = [];
    $("#default-1 #continue").click(async (e) => {
        e.preventDefault(e);

        let success;
        let token = $("#token").val();
        $("#continue").addClass("loading");

        if (!token) return;
        token = token.replace(/^"(.+)"$/, "$1");

        success = true

        let res = await API.request("GET", API.guilds, token);
        if (!res.ok) return error(res.status === 401 ? "Invalid token." : "Could not authenticate with Discord.");

        const guildsDropdown = (await res.json()).sort(sortAlpha).map(guild => {
            return {
                name: guild.icon
                    ? `<img src="${getGuildIcon(guild)}" />${guild.name}`
                    : guild.name,
                value: guild.id
            }
        });

        $("#server-select").dropdown({
            values: guildsDropdown,
            placeholder: "Select Server",
            onChange: async (value, text, $selected) => {
                $("#default-2").append(`<div class="ui active dimmer"><div class="ui loader"></div></div>`);
                $("#error").hide();
                $("#messages div.message").hide();
                $("#download").remove();

                let res = await API.request("GET", API.guild(value), token);
                if (!res.ok) return error("Could not fetch server emojis.");

                globalThis.guild = await res.json();
                globalThis.emojis = renameEmoji(globalThis.guild.emojis)
                    .sort(sortAlpha);
                globalThis.stickers = globalThis.guild.stickers.sort(sortAlpha);

                let emojis = globalThis.emojis.reduce((acc, val, i) => {
                    if (i > 149) {
                        acc[1].push(val);
                    } else {
                        acc[0].push(val);
                    }
                    return acc;
                }, [[], []]);

                const minecraftVersionDropdown = [];

                let isFirstElement = true;

                for (const [versionName, packFormat] of Object.entries({
                    "1.20.x": 15,
                    "1.19.4": 13,
                    "1.19-1.19.2": 9,
                    "1.18.x": 8,
                    "1.17.x": 7
                })) {
                    minecraftVersionDropdown.push({
                        name: `<img src="https://github.com/aratakileo/static.pexty.xyz/blob/main/src/emoji/animated/minecraft.gif?raw=true" style="width: 1.5em!important; height: 1.5em!important;" /> ${versionName}`,
                        value: packFormat,
                        selected: isFirstElement
                    });

                    isFirstElement = false;
                }

                $("#minecraft-version-select").dropdown({
                    values: minecraftVersionDropdown,
                    placeholder: "Select Minecraft version",
                    onChange: (value, text, $selected) => {
                        globalThis.packFormat = value;
                    }
                })

                let emojisDropdown = [];

                for (const emojiSegment of emojis)
                    for (const emoji of emojiSegment)
                        emojisDropdown.push({
                            name: `<img src="${getEmojiUrl(emoji.id, emoji.animated)}" style="width: 1.5em!important; height: 1.5em!important;" /> ${emoji.name}`,
                            value: emoji.id,
                            selected: true
                        });

                $("#emoji-select").dropdown({
                    values: emojisDropdown,
                    placeholder: "Select Emojis",
                    onChange: (value, text, $selected) => {
                        $("#emojicount").text(`(${$("input[name='emojis']").val().split(",").length}/${emojis[0].length + emojis[1].length})`);
                    }
                })

                $("#minecraft-version").show();
                $("#emojis").show();
                $(".active.dimmer").remove();
            }
        });

        $("#default-1").attr("data-tab", "default-hide");
        $("#default-2").attr("data-tab", "default");
        $.tab("change tab", "default");
    });

    $("#default-2 #submit").click(async (e) => {
        e.preventDefault(e);

        if (!globalThis.emojis.length) return error("Please select at least one emoji.");
        try {
            if (globalThis.guild.emojis.length < 1) return error("This server doesn't have any emojis!");
            const cleanGuildName = globalThis.guild.name.replace(/\s/g, "_").replace(/\W/g, "");
            const cleanGuildNameLower = cleanGuildName.toLowerCase();
            console.log("Emojis:", globalThis.emojis.length);

            show("#loading");

            const renamedEmoji = renameEmoji(globalThis.emojis);
            const zip = new JSZip();

            zip.file("pack.mcmeta", JSON.stringify({
                "pack": {
                  "description": "Auto-generated at https://aratakileo.github.io/emogg-resourcepack-maker/",
                  "pack_format": globalThis.packFormat
                }
            }));

            zip.file("pack.png", await fetchIgnoreCORS(getGuildIcon(globalThis.guild)));
            
            const baseFolder = zip.folder("assets/emogg");
            const categoryName = `discord_server_${cleanGuildNameLower}`;
            const emojiFolder = baseFolder.folder(`emoji/${categoryName}`);
            
            let translationData = {};
            translationData[`emogg.category.${categoryName}`] = cleanGuildName;

            baseFolder.folder("lang").file("en_us.json", JSON.stringify(translationData));

            let emojiCount = 0;
            for (let i in renamedEmoji) {
                emojiFolder.file(
                    `${renamedEmoji[i].name}.${renamedEmoji[i].animated ? "gif" : "png"}`,
                    await fetchIgnoreCORS(getEmojiUrl(renamedEmoji[i].id, renamedEmoji[i].animated))
                );
                emojiCount++;
            }

            $("#success-msg #emoji-count").text(emojiCount);
            show("#success");
            $("#default-2 #submit").after(downloadBtn);

            downloadBtn.click(() => {
                zip.generateAsync({ type: "blob" }).then(content => {
                    saveAs(content, `emogg-discord-${cleanGuildNameLower}.zip`);
                });
            })
        } catch(err) {
            return error(err);
        }
    });

    $("button #continue").click(() => {
        $("#error").hide();
    });

    function show(id) {
        $("#messages div.message").hide();
        $(id).fadeIn("slow").css("display", "inline-flex");
    }

    function error(message, ...args) {
        console.error(message, ...args);
        $("button").removeClass("loading");
        $("#error-msg").text(message);
        show("#error");
    }

    function renameEmoji(emojis) {
        if (!emojis) return console.error("No Emojis Array");
        const emojiCountByName = {};
        const disambiguatedEmoji = [];
        const customEmojis = {};
        const emojisByName = {};
        const emojisById = {};

        const disambiguateEmoji = emoji => {
            const originalName = emoji.name;
            const existingCount = emojiCountByName[originalName] || 0;
            emojiCountByName[originalName] = existingCount + 1;
            if (existingCount > 0) {
                const name = `${originalName}~${existingCount}`;
                emoji = {
                    ...emoji,
                    name,
                    originalName
                };
            }

            emojisByName[emoji.name] = emoji;
            if (emoji.id) {
                emojisById[emoji.id] = emoji;
                customEmojis[emoji.name] = emoji;
            }
            disambiguatedEmoji.push(emoji);
        };

        emojis.forEach(disambiguateEmoji);
        return disambiguatedEmoji;
    }
});
