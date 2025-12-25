// NOTE: These can be overridden in dev/prod via Vite env vars:
// - VITE_PACKAGE_ID=0x...
// - VITE_NETWORK=testnet|mainnet
const DEFAULT_PACKAGE_ID = "0x8db687a9af4ab7fbc6edd372f0eb54e1d9c8ccf957ca2f30723cd71e762e22d1";
const DEFAULT_NETWORK = "testnet" as const;

export const PACKAGE_ID = (import.meta.env.VITE_PACKAGE_ID as string | undefined) ?? DEFAULT_PACKAGE_ID;
export const NETWORK = ((import.meta.env.VITE_NETWORK as string | undefined) ?? DEFAULT_NETWORK) as "testnet" | "mainnet";

// Image URLs
export const IMAGES = {
  blueprint: [
    "https://rose-absent-elk-883.mypinata.cloud/ipfs/bafybeiduk4tawmta3tmrauwav7lvg2gpao6q4chhs5gldpnfsmngtft56e"
  ],
  armor: [
    "https://rose-absent-elk-883.mypinata.cloud/ipfs/bafkreiabyqq4cll75i7jqkzjrwx3jnxdx2ccwwqokjf3vul6sv2xsq7kx4",
    "https://rose-absent-elk-883.mypinata.cloud/ipfs/bafkreihjuwtrhpaqbn4alnh4dm3dxaqyhy5lf6jop5np4cigr423nvpbsu",
    "https://rose-absent-elk-883.mypinata.cloud/ipfs/bafkreifgrfgwuwxa2oregurppm2hc6ochcik2z4f5lk5zzqdeylj2rlyea",
    "https://rose-absent-elk-883.mypinata.cloud/ipfs/bafkreianyhb7ykfw6p45p62yvsp7erke3lz7vyvojasjpggwx5nxfrsdli",
    "https://rose-absent-elk-883.mypinata.cloud/ipfs/bafkreicrpcpl6zrw7oxmkj3lkiwiowpuisnx3xqqki47dhcao3sxxfofhu",
    "https://rose-absent-elk-883.mypinata.cloud/ipfs/bafkreiefybyohcif7ciptt3c6clqq65uakcw5jsun4hvxdwo74iopyym6e",
    "https://rose-absent-elk-883.mypinata.cloud/ipfs/bafkreibdrxlhda43rldbbaagagvuaevgpqhvymtduifr4k3cprxataoga4",
    "https://rose-absent-elk-883.mypinata.cloud/ipfs/bafkreigzvj7jdt5n36ce6h7xbpwxqcbhsdt433eig34xc2f2vrpzwhgjwq",
    "https://rose-absent-elk-883.mypinata.cloud/ipfs/bafkreiecdpmn6qyvse4fnianprlxhul3qx7iu4usihfpv7nriomw6qnp3i",
    "https://rose-absent-elk-883.mypinata.cloud/ipfs/bafkreiapz6kscc67vhcpiievfdyeg4bvrzkomc37kzwwthusia2osxbfbu",
    "https://rose-absent-elk-883.mypinata.cloud/ipfs/bafkreid2ahpx3nfwgs4smbgnhhvj6mlvihe7racs6c5ejpyvgxyhxzc23q",
    "https://rose-absent-elk-883.mypinata.cloud/ipfs/bafkreie22a5qum6c33qrlzlwuzcb7isda4mbvj3nxfubblz7ii4yu6nld4",
    "https://rose-absent-elk-883.mypinata.cloud/ipfs/bafkreiciy7padzbisn4axijtne34axpqmk3yoytoveojxewfg64jgmucra",
    "https://rose-absent-elk-883.mypinata.cloud/ipfs/bafkreibub4nfzmc4dlhdxdgu4s4qowdnj745bfhuka5vcxa5s67se3qdpu"
  ],
  collectible: [
    "https://rose-absent-elk-883.mypinata.cloud/ipfs/bafkreic6vbli2y6ldxstqbu7xrmf3qhpx7qgpux6vv3glsblj4qas52ugm",
    "https://rose-absent-elk-883.mypinata.cloud/ipfs/bafkreidgrtw3putur4mvmnfxptrgerxtxjqbfxmhaykcwkm6rnypqmaoeu",
    "https://rose-absent-elk-883.mypinata.cloud/ipfs/bafkreibdzn6nq3v63ud6cqgb7f5rkdcva5xjkpg6v5bgvxkrgj3aug53um",
    "https://rose-absent-elk-883.mypinata.cloud/ipfs/bafkreifqu2vouktoe333ktfagjrn5qfrbvwjfuzerfohjh67oc4zuenc3y",
    "https://rose-absent-elk-883.mypinata.cloud/ipfs/bafkreib2btztdkpdovbgmpzp5f76cpmnk6xiqi7yg5z4gaj7htktzkbyjm",
    "https://rose-absent-elk-883.mypinata.cloud/ipfs/bafkreiddqi6k2bkakqd2zcokjeioax6oqkkjhelkcxbzhg63r3yydehgxq",
    "https://rose-absent-elk-883.mypinata.cloud/ipfs/bafkreifaftvx6parfmh7d7huypqy3c6lrcf5gjtubwwttprsga3idoygmm",
    "https://rose-absent-elk-883.mypinata.cloud/ipfs/bafkreiao73uzrobdxoaq3lms7dyeho7ffxr72mckr2lx7riaf23vbjxsqe",
    "https://rose-absent-elk-883.mypinata.cloud/ipfs/bafkreifiznz5inb3tztnoozjicbktf37gxbua7ikvtffqgp2tpwgdvpjo4",
    "https://rose-absent-elk-883.mypinata.cloud/ipfs/bafkreigdc4xridf3k2cpbiiubizanh6ny6g7ngvvsxvlh7qfhh2w73yfnq",
    "https://rose-absent-elk-883.mypinata.cloud/ipfs/bafkreib2edvlobu2whdb4gsomm7g7zr6367mq6bfitpggmnyroatnpppk4",
    "https://rose-absent-elk-883.mypinata.cloud/ipfs/bafkreif6sk3muxriz2p7dba6jeu6rxjcnsv7ekbkjkorm5vi42opcrfiju",
    "https://rose-absent-elk-883.mypinata.cloud/ipfs/bafkreiebwzeaxnig3ji22zv7jxxwb4mzc566rosem4pe2jgq63y5dvdcyu",
    "https://rose-absent-elk-883.mypinata.cloud/ipfs/bafkreibzm5oicyoeswjuztlj3t22xf7frf7ouza2nsof6m4o3xixa27p5u"
  ],
  food: [
    "https://rose-absent-elk-883.mypinata.cloud/ipfs/bafkreifmw36rzmxqbhh63l5alboxal3ikobl2p7plfndb7bcpinuczfw5m",
    "https://rose-absent-elk-883.mypinata.cloud/ipfs/bafkreibzbjwk62o56rqleeevlyf5dh775focjexqh3kcahx7hbrnthpopi",
    "https://rose-absent-elk-883.mypinata.cloud/ipfs/bafkreid7jyvcfvv5o6mm5ybzhhy5tuxbgm5ouggrsnb3ku572veaohkl4q",
    "https://rose-absent-elk-883.mypinata.cloud/ipfs/bafkreickkuwtrjsfdfiblu3ayewfgzcq4epkjzbqdcbtmjfjtua3tmwaga",
    "https://rose-absent-elk-883.mypinata.cloud/ipfs/bafkreiasatabupexv5qnvgz2v3esknxpdrrbrajzcltctesp4byqaiqhia",
    "https://rose-absent-elk-883.mypinata.cloud/ipfs/bafkreigerah6ngnwf4wmlevlx44vjoaqnsm777a2npkgqc3c3hu3c5wui4",
    "https://rose-absent-elk-883.mypinata.cloud/ipfs/bafkreigydqmufvk6njzsszli7qu4zvadaghgp3mitquag6rdurzrwsys64",
    "https://rose-absent-elk-883.mypinata.cloud/ipfs/bafkreigsdzy3iactxinstdjjjdbadhwms56lirmh2tlrqe25gxrydkmsh4",
    "https://rose-absent-elk-883.mypinata.cloud/ipfs/bafkreihvp7sfzxdwm33xbvc2k325sdjzf2kxat6hrn665qnau5s3j7hkie",
    "https://rose-absent-elk-883.mypinata.cloud/ipfs/bafkreicwaajfdfzvuvdbh4wqkudrqjq2bri3efq24okuayom7st4mxrovi"
  ],
  medicine: [
    "https://rose-absent-elk-883.mypinata.cloud/ipfs/bafkreigcvj5xzlfzy7b4epmreo2a4jwrffjuje7giyjtjfosz7eti6cldq",
    "https://rose-absent-elk-883.mypinata.cloud/ipfs/bafkreigznhgfq6vsdyzmcupper66puovjequjbqhrs2y2r6ccndyns5mem",
    "https://rose-absent-elk-883.mypinata.cloud/ipfs/bafkreif2ugdksa6siotumm3wesfc62qm4svv7kbu3fddo7mnpv74mjl55a"
  ],
  revivalPotion: [
    "https://rose-absent-elk-883.mypinata.cloud/ipfs/bafkreigd2vr6xvfxfxaajew4pi6wmm2klqchz7wp4mzjacv2np4wuschfy"
  ],
  tool: [
    "https://rose-absent-elk-883.mypinata.cloud/ipfs/bafkreicvoficajmag37fljd7s4ctlsgv3wivztcisra6pve3u6u5h6dbp4",
    "https://rose-absent-elk-883.mypinata.cloud/ipfs/bafkreighuhf6oqiaov5sif2gwp7uajzxjwtl7r247f7vcvikzt7vw5tq5q",
    "https://rose-absent-elk-883.mypinata.cloud/ipfs/bafkreidkckw753ov2d7yjt2hqipm2eruxpzbmc5ao3e4rggjdotb2m5i3u",
    "https://rose-absent-elk-883.mypinata.cloud/ipfs/bafkreifxqddpau2q6gi6srgaaknxm7la6cb3rnvutlulegyhgu7i4b7fxu"
  ],
  weapon: [
    "https://rose-absent-elk-883.mypinata.cloud/ipfs/bafkreih4fmxyel4k4dlvnxgf4l5jjmptvsrli22vgoknhv2f3onxgndlli",
    "https://rose-absent-elk-883.mypinata.cloud/ipfs/bafkreiatdlxz6yd6geapokl67r2sptlqns23lk6m4lxiwufbsd62jsjnj4",
    "https://rose-absent-elk-883.mypinata.cloud/ipfs/bafkreifjegzdmyvhyja6tewe5qsm7xl3mbnunhwl6sqsov36jku33whj3u"
  ],
  npc: [
    "https://rose-absent-elk-883.mypinata.cloud/ipfs/bafkreiglut7gldwz25e4ujqraudinal7tao2vqok743p2cs45blozospfu",
    "https://rose-absent-elk-883.mypinata.cloud/ipfs/bafkreibo2p64e5fr5nygsi7wv3uc6fubq6vqkdi53b3t63zrj2722cetlm",
    "https://rose-absent-elk-883.mypinata.cloud/ipfs/bafkreifeodvr3xfulztmnow6hz5zz3aspc6rrxkzl4izzevwhpbaknfi3e",
    "https://rose-absent-elk-883.mypinata.cloud/ipfs/bafkreihumpjiszd7b4kpovukedi2lys2ne2efxos7kj342dwlsrmkbunge",
    "https://rose-absent-elk-883.mypinata.cloud/ipfs/bafkreigxtxk422bymlwfasirk3n5l3y63mdjn7szyly5iapqktq7bhbqse",
    "https://rose-absent-elk-883.mypinata.cloud/ipfs/bafkreihpmyd5wrj3ncnrdcswcukvppnwysexujtl7pdvhc4jvc7arkz72q",
    "https://rose-absent-elk-883.mypinata.cloud/ipfs/bafkreih6az6c2igvbigqrpk6s4vs3pjuunl2jk56xu5xbkfml2ukznrofq",
    "https://rose-absent-elk-883.mypinata.cloud/ipfs/bafkreiei3sop2r6djex5euqvyi4p4fyytypcfdkv6lllaqiktvc6hb57qq",
    "https://rose-absent-elk-883.mypinata.cloud/ipfs/bafkreicctkdafqmejz2bkdeblqjteuanqrtc6wx6vsfajatmpy7rouudiq",
    "https://rose-absent-elk-883.mypinata.cloud/ipfs/bafkreidup3xh6td27zywntvr2b7yuyaggidafbpuozw55ipgqgm7hujb5e",
    "https://rose-absent-elk-883.mypinata.cloud/ipfs/bafkreihedccj64qfbbfwx5oj2cuogjx5risj6e54vbt7kp5jrvfmeidbpm",
    "https://rose-absent-elk-883.mypinata.cloud/ipfs/bafkreicqsypww3utwke7dmikkrcxnfl6zl5aoac5y44n66se6qen56t2si",
    "https://rose-absent-elk-883.mypinata.cloud/ipfs/bafkreiazfnl6ihanaxryi3bch4hr6m7sltixk5xafynonuidy2z2dfqt5u",
    "https://rose-absent-elk-883.mypinata.cloud/ipfs/bafkreibxq6cnzwmavimppg3g5ybsfi3iqppsjvrf6lvx6qkrp23lr4way4",
    "https://rose-absent-elk-883.mypinata.cloud/ipfs/bafkreiat33af7soe5wmvsf6y3wgqxmhfepw7ib2csjk4br7ilrlreacfpe",
    "https://rose-absent-elk-883.mypinata.cloud/ipfs/bafkreih2eymknmqsf6uuvmuego4oksgzbw7n6xqxidf45vyhuhqv7qlscu",
    "https://rose-absent-elk-883.mypinata.cloud/ipfs/bafkreic4s3mn4h2ggj2i7drbps5uawqz7xbptvtknnr2q4fp6gxduczani",
    "https://rose-absent-elk-883.mypinata.cloud/ipfs/bafkreiccfxxnni72tkj54xy2hzv2obe5vyh6ubqyyubkwrnjlj7n3jqb74",
    "https://rose-absent-elk-883.mypinata.cloud/ipfs/bafkreih6nhtc7ddt2uogqddoyhvit6kso3t5rnqs7m4gowgwte3wsuzwfi",
    "https://rose-absent-elk-883.mypinata.cloud/ipfs/bafkreihpu66bt6jlpld5dzzwgon6vbr2qrewdpfdix7btcsp33bclep4qq",
    "https://rose-absent-elk-883.mypinata.cloud/ipfs/bafkreibiftyofdp5m427fiarbio4opyuwjbmbrq2hzh4emixrtrvk6kgza",
    "https://rose-absent-elk-883.mypinata.cloud/ipfs/bafkreifm7l5i4pgqvy5s5avwgud5a34jqmg52sdu5vguzdwuqpbusmimby",
    "https://rose-absent-elk-883.mypinata.cloud/ipfs/bafkreidvmo4v4r6bv3imglv2euqgg5buh4yvlfyjpwzuc3cycajtnydtsu",
    "https://rose-absent-elk-883.mypinata.cloud/ipfs/bafkreiatsx6er5podhpzcxkw47uitxh2aeqszxpdvjmsk2lvyicwsrxiym",
    "https://rose-absent-elk-883.mypinata.cloud/ipfs/bafkreihzrszmdy4l4kdqah2lv4xtr7n5aaotclynq42gfth64owsma3hvy",
    "https://rose-absent-elk-883.mypinata.cloud/ipfs/bafkreidfx3f2lqmfrq2nbwsvw2453iqelyuoph463e5br4tc62ommlco7y",
    "https://rose-absent-elk-883.mypinata.cloud/ipfs/bafkreignsm4ch7yqafallxkmwqb536q55wxum3ltjivep5z6cdpufs5dxy"
  ],
  room: [
    // Index aligned with ROOM_TYPES order
    // 0: LIVING
    "https://rose-absent-elk-883.mypinata.cloud/ipfs/bafybeiflwxho5gsswfag3zyy4p6wvvorzon5myf2fysvn3tihrekkmtmhi",
    // 1: GENERATOR (power)
    "https://rose-absent-elk-883.mypinata.cloud/ipfs/bafybeibrlzmyj6hiksjznwwqocdyuts2zy3tkmffidwlar3zfuhz46rk4q",
    // 2: FARM
    "https://rose-absent-elk-883.mypinata.cloud/ipfs/bafybeihwxrzjpwjnfxo3isrxpbs2ht2vjqtth5alebzxczfpbgvky27uqy",
    // 3: WATER_PUMP
    "https://rose-absent-elk-883.mypinata.cloud/ipfs/bafybeiatxg247ucqjnxu43qi3qxff534jwifg6njv6i2lx4h3xrdidpe5u",
    // 4: WORKSHOP
    "https://rose-absent-elk-883.mypinata.cloud/ipfs/bafybeid3wtdmehkcoqhmdud2pgsvwai3ubwgttti7egrkzjbuctibnfuma",
    // 5: STORAGE
    "https://rose-absent-elk-883.mypinata.cloud/ipfs/bafybeie5zd5seceiclcfdzx5mgjnwwv2wvugm46pta2ttw5fn7vxg6de4u"
  ],
  background: "https://rose-absent-elk-883.mypinata.cloud/ipfs/bafkreibsiqwhc4uf72656ropvmqpapf4zws5ugteno5exdluajibu7od5m"
};

// Room types mapping
export const ROOM_TYPES = {
  LIVING: 0,
  GENERATOR: 1,
  FARM: 2,
  WATER_PUMP: 3,
  WORKSHOP: 4,
  STORAGE: 5,
} as const;

export const ROOM_TYPE_NAMES = {
  [ROOM_TYPES.LIVING]: "Living Quarters",
  [ROOM_TYPES.GENERATOR]: "Generator",
  [ROOM_TYPES.FARM]: "Farm",
  [ROOM_TYPES.WATER_PUMP]: "Water Pump",
  [ROOM_TYPES.WORKSHOP]: "Workshop",
  [ROOM_TYPES.STORAGE]: "Storage",
} as const;

// NPC status
export const NPC_STATUS = {
  IDLE: 0,
  ON_MISSION: 1,
  KNOCKED: 2,
  WORKING: 3,
} as const;

export const NPC_PROFESSION_NAMES = {
  0: "Scavenger",
  1: "Farmer",
  2: "Butcher",
  3: "Soldier",
  4: "Doctor",
};

// Item types
export const ITEM_TYPES = {
  WEAPON: 1,
  ARMOR: 2,
  TOOL: 3,
  MEDICINE: 4,
  REVIVAL_POTION: 5,
  FOOD: 6,
  WATER: 7,
  COLLECTIBLE: 99,
} as const;

// Rarity
export const RARITY = {
  COMMON: 0,
  UNCOMMON: 1,
  RARE: 2,
  EPIC: 3,
  LEGENDARY: 4,
  MYTHIC: 5,
} as const;

export const RARITY_NAMES = {
  [RARITY.COMMON]: "Common",
  [RARITY.UNCOMMON]: "Uncommon",
  [RARITY.RARE]: "Rare",
  [RARITY.EPIC]: "Epic",
  [RARITY.LEGENDARY]: "Legendary",
  [RARITY.MYTHIC]: "Mythic",
} as const;

// Rooms per row
export const ROOMS_PER_ROW = 3;

