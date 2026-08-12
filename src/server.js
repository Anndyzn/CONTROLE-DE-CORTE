"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const path_1 = __importDefault(require("path"));
const cortes_routes_1 = __importDefault(require("./routes/cortes.routes"));
const producao_routes_1 = __importDefault(require("./routes/producao.routes"));
const itens_routes_1 = __importDefault(require("./routes/itens.routes"));
const consultas_routes_1 = __importDefault(require("./routes/consultas.routes"));
const app = (0, express_1.default)();
app.use(express_1.default.json());
app.use(express_1.default.static(path_1.default.join(__dirname, "public")));
app.get("/", (req, res) => {
    res.sendFile(path_1.default.join(__dirname, "public", "index.html"));
});
app.use(cortes_routes_1.default);
app.use(producao_routes_1.default);
app.use(itens_routes_1.default);
app.use(consultas_routes_1.default);
const PORT = Number(process.env.PORT) || 3000;
app.listen(PORT, "0.0.0.0", () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
