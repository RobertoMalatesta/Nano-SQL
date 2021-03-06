Object.defineProperty(exports, "__esModule", { value: true });
var index_1 = require("./index");
var lie_ts_1 = require("lie-ts");
var _NanoSQLQuery = (function () {
    function _NanoSQLQuery(table, db, actionOrView) {
        this._db = db;
        this._modifiers = [];
        this._table = table;
        this._AV = actionOrView || "";
    }
    _NanoSQLQuery.prototype.tID = function (transactionID) {
        return this._transactionID = transactionID || 0, this;
    };
    _NanoSQLQuery.prototype.where = function (args) {
        if (!args.length || !Array.isArray(args)) {
            this._error = "Where condition requires an array!";
        }
        return this._addCmd("where", args);
    };
    _NanoSQLQuery.prototype.range = function (limit, offset) {
        return this._addCmd("range", [limit, offset]);
    };
    _NanoSQLQuery.prototype.orm = function (ormArgs) {
        return this._addCmd("orm", ormArgs);
    };
    _NanoSQLQuery.prototype.orderBy = function (args) {
        return this._addCmd("orderby", args);
    };
    _NanoSQLQuery.prototype.groupBy = function (columns) {
        return this._addCmd("groupby", columns);
    };
    _NanoSQLQuery.prototype.having = function (args) {
        if (!args.length || !Array.isArray(args)) {
            this._error = "Having condition requires an array!";
        }
        return this._addCmd("having", args);
    };
    _NanoSQLQuery.prototype.join = function (args) {
        if (!args.table || !args.type) {
            this._error = "Join command requires table and type arguments!";
        }
        return this._addCmd("join", args);
    };
    _NanoSQLQuery.prototype.limit = function (args) {
        return this._addCmd("limit", args);
    };
    _NanoSQLQuery.prototype.trieSearch = function (column, stringToSearch) {
        return this._addCmd("trie", [column, stringToSearch]);
    };
    _NanoSQLQuery.prototype.offset = function (args) {
        return this._addCmd("offset", args);
    };
    _NanoSQLQuery.prototype._addCmd = function (type, args) {
        return this._modifiers.push({ type: type, args: args }), this;
    };
    _NanoSQLQuery.prototype.toCSV = function (headers) {
        var t = this;
        return new lie_ts_1.Promise(function (res, rej) {
            t.exec().then(function (json) {
                json = index_1._assign(json);
                var header = t._action.args.length ? t._action.args.map(function (m) {
                    return t._db._models[t._table].filter(function (f) { return f["key"] === m; })[0];
                }) : t._db._models[t._table];
                if (headers) {
                    json.unshift(header.map(function (h) {
                        return h["key"];
                    }));
                }
                res(json.map(function (row, i) {
                    if (headers && i === 0)
                        return row;
                    return header.map(function (column) {
                        if (row[column["key"]] === undefined) {
                            return "";
                        }
                        else {
                            var columnType = column["type"];
                            if (columnType.indexOf("[]") !== -1)
                                columnType = "any[]";
                            switch (columnType) {
                                case "map":
                                case "any[]":
                                case "array": return '"' + JSON.stringify(row[column["key"]]).replace(/"/g, "'") + '"';
                                case "string":
                                case "safestr": return '"' + row[column["key"]].replace(/"/g, '\"') + '"';
                                default: return row[column["key"]];
                            }
                        }
                    }).join(",");
                }).join("\n"), t);
            });
        });
    };
    _NanoSQLQuery.prototype.manualExec = function (table, modifiers) {
        var t = this;
        t._modifiers = modifiers;
        t._table = table;
        return t.exec();
    };
    _NanoSQLQuery.prototype.exec = function () {
        var t = this;
        var _t = t._table;
        if (t._db._hasEvents[_t]) {
            t._db._triggerEvents = (function () {
                switch (t._action.type) {
                    case "select": return ["*", t._action.type];
                    case "delete":
                    case "upsert":
                    case "drop": return ["*", t._action.type, "change"];
                    default: return ["*"];
                }
            })();
        }
        return new lie_ts_1.Promise(function (res, rej) {
            if (t._error) {
                rej(t._error);
                throw Error;
            }
            if (!t._db.backend) {
                rej();
                throw Error;
            }
            var _tEvent = function (data, callBack, type, changedRows, changedRowPKS, isError) {
                if (t._db._hasEvents[_t]) {
                    t._db.triggerEvent({
                        name: t._action.type,
                        actionOrView: t._AV,
                        table: _t,
                        query: [t._action].concat(t._modifiers),
                        time: new Date().getTime(),
                        result: data,
                        changeType: type,
                        changedRows: changedRows,
                        changedRowPKS: changedRowPKS
                    }, t._db._triggerEvents);
                }
                callBack(data, t._db);
            };
            var execArgs = {
                table: _t,
                transactionID: t._transactionID,
                query: [t._action].concat(t._modifiers),
                viewOrAction: t._AV,
                onSuccess: function (rows, type, affectedRows, affectedPKS) {
                    if (t._transactionID) {
                        res(rows, t._db);
                    }
                    else {
                        _tEvent(rows, res, type, affectedRows, affectedPKS, false);
                    }
                },
                onFail: function (err) {
                    if (t._transactionID) {
                        res(err, t._db);
                    }
                    else {
                        t._db._triggerEvents = ["error"];
                        if (rej)
                            _tEvent(err, rej, "error", [], [], true);
                    }
                }
            };
            if (t._db._queryMod) {
                t._db._queryMod(execArgs, function (newArgs) {
                    t._db.backend._exec(newArgs);
                });
            }
            else {
                t._db.backend._exec(execArgs);
            }
        });
    };
    return _NanoSQLQuery;
}());
exports._NanoSQLQuery = _NanoSQLQuery;
var _NanoSQLORMQuery = (function () {
    function _NanoSQLORMQuery(db, table, action, column, relationIDs) {
        this._db = db;
        this._tableName = table;
        this._action = action;
        this._column = column || "";
        this._relationIDs = relationIDs || [];
    }
    _NanoSQLORMQuery.prototype.where = function (args) {
        this._whereArgs = args;
        return this;
    };
    _NanoSQLORMQuery.prototype.rebuild = function (callBack) {
        var t = this;
        var relations = t._db._models[t._tableName].filter(function (m) {
            return t._db._tableNames.indexOf(m.type.replace("[]", "")) !== -1;
        }).map(function (m) {
            var tableName = m.type.replace("[]", "");
            return {
                _key: m.key,
                _tablePK: t._db._models[tableName].reduce(function (prev, cur) {
                    if (cur.props && cur.props.indexOf("pk") !== -1)
                        return cur.key;
                    return prev;
                }, ""),
                _table: tableName,
                _type: m.type.indexOf("[]") === -1 ? "single" : "array"
            };
        });
        var tablePK = t._db._models[t._tableName].reduce(function (prev, cur) {
            if (cur.props && cur.props.indexOf("pk") !== -1)
                return cur.key;
            return prev;
        }, "");
        var ptr = 0;
        var nextRow = function () {
            t._db.table(t._tableName).query("select").range(1, ptr).exec().then(function (rows) {
                if (rows.length) {
                    index_1.NanoSQLInstance.chain(relations.map(function (r) {
                        return function (nextRelation) {
                            var ids;
                            if (rows[0][r._key] === undefined) {
                                ids = r._type === "single" ? "" : [];
                            }
                            else {
                                ids = index_1._assign(rows[0][r._key]);
                            }
                            if (r._type === "single")
                                ids = [ids];
                            ids = ids.filter(function (v, i, s) {
                                return s.indexOf(v) === i;
                            });
                            t._db.table(r._table).query("select").where([r._tablePK, "IN", ids]).exec().then(function (childRows) {
                                var activeIDs = childRows.length ? childRows.map(function (row) { return row[r._tablePK]; }) : [];
                                return t._db.table(t._tableName).updateORM("set", r._key, activeIDs).where([tablePK, "=", rows[0][tablePK]]).exec();
                            }).then(function () {
                                nextRelation();
                            });
                        };
                    }))(function () {
                        ptr++;
                        nextRow();
                    });
                }
                else {
                    callBack(ptr);
                }
            });
        };
        nextRow();
    };
    _NanoSQLORMQuery.prototype.tID = function (transactionID) {
        return this._transactionID = transactionID || 0, this;
    };
    _NanoSQLORMQuery.prototype.exec = function () {
        var t = this;
        return new lie_ts_1.Promise(function (res, rej) {
            if (t._action === "rebuild") {
                return t.rebuild(res);
            }
            var pk = t._db._models[t._tableName].filter(function (m) {
                return m.props && m.props.indexOf("pk") !== -1;
            })[0].key;
            var rowModel = t._db._models[t._tableName].filter(function (m) { return m.key === t._column; })[0];
            var relationTable = rowModel.type.replace("[]", "");
            var relationPK = t._db._models[relationTable].filter(function (m) {
                return m.props && m.props.indexOf("pk") !== -1;
            })[0].key;
            var isArrayRelation = rowModel.type.indexOf("[]") !== -1;
            var mapTo = rowModel.props && rowModel.props.filter(function (p) { return p.indexOf("ref=>") !== -1; })[0];
            var mapToIsArray = "single";
            if (mapTo) {
                mapTo = mapTo.replace("ref=>", "");
                mapToIsArray = t._db._models[relationTable].filter(function (m) { return m.key === mapTo; })[0].type.indexOf("[]") === -1 ? "single" : "array";
            }
            if (!pk || !pk.length || !relationPK || !relationPK.length) {
                rej("Relation models require a primary key!");
                return;
            }
            var query = t._db.table(t._tableName).query("select");
            if (t._whereArgs)
                query.where(t._whereArgs);
            query.exec().then(function (rows) {
                index_1.NanoSQLInstance.chain(rows.map(function (rowData) {
                    return function (nextRow) {
                        var newRow = index_1._assign(rowData);
                        var oldRelations = [];
                        if (newRow[t._column] !== undefined)
                            oldRelations = index_1._assign(newRow[t._column]);
                        if (!Array.isArray(oldRelations))
                            oldRelations = [oldRelations];
                        switch (t._action) {
                            case "set":
                            case "add":
                                if (isArrayRelation) {
                                    if (newRow[t._column] === undefined)
                                        newRow[t._column] = [];
                                    if (!Array.isArray(newRow[t._column]))
                                        newRow[t._column] = [];
                                    if (t._action === "set") {
                                        newRow[t._column] = t._relationIDs;
                                    }
                                    else {
                                        newRow[t._column] = newRow[t._column].concat(t._relationIDs);
                                    }
                                    newRow[t._column] = newRow[t._column].filter(function (v, i, s) {
                                        return s.indexOf(v) === i;
                                    });
                                }
                                else {
                                    newRow[t._column] = t._relationIDs[0];
                                }
                                if (t._action === "set") {
                                    oldRelations = oldRelations.filter(function (item) {
                                        return t._relationIDs.indexOf(item) === -1;
                                    });
                                }
                                else {
                                    oldRelations = [];
                                }
                                break;
                            case "delete":
                                if (isArrayRelation) {
                                    t._relationIDs.forEach(function (relId) {
                                        var loc = newRow[t._column].indexOf(relId);
                                        if (loc !== -1)
                                            newRow[t._column].splice(loc, 1);
                                    });
                                }
                                else {
                                    newRow[t._column] = "";
                                }
                                break;
                            case "drop":
                                newRow[t._column] = isArrayRelation ? [] : undefined;
                                break;
                        }
                        var updateRow = function (newRow, callBack) {
                            t._db.table(relationTable).query("upsert", newRow, true).exec().then(callBack);
                        };
                        var removeOldRelations = function (callBack) {
                            index_1.NanoSQLInstance.chain(oldRelations.map(function (oldRelID) {
                                return function (nextRelation) {
                                    t._db.table(relationTable).query("select").where([relationPK, "=", oldRelID]).exec().then(function (relateRows) {
                                        if (!relateRows.length) {
                                            nextRelation();
                                            return;
                                        }
                                        var modifyRow = index_1._assign(relateRows[0]);
                                        if (Array.isArray(modifyRow[mapTo])) {
                                            var idx = modifyRow[mapTo].indexOf(rowData[pk]);
                                            if (idx !== -1) {
                                                modifyRow[mapTo].splice(idx, 1);
                                            }
                                        }
                                        else {
                                            modifyRow[mapTo] = "";
                                        }
                                        updateRow(modifyRow, function () {
                                            nextRelation();
                                        });
                                    });
                                };
                            }))(function () {
                                callBack();
                            });
                        };
                        t._db.table(t._tableName).query("upsert", newRow, true).exec().then(function () {
                            if (mapTo) {
                                switch (t._action) {
                                    case "set":
                                    case "add":
                                        removeOldRelations(function () {
                                            index_1.NanoSQLInstance.chain(t._relationIDs.map(function (relID) {
                                                return function (nextRelation) {
                                                    t._db.table(relationTable).query("select").where([relationPK, "=", relID]).exec().then(function (relateRows) {
                                                        if (!relateRows.length) {
                                                            nextRelation();
                                                            return;
                                                        }
                                                        var modifyRow = index_1._assign(relateRows[0]);
                                                        if (modifyRow[mapTo] === undefined)
                                                            modifyRow[mapTo] = mapToIsArray === "array" ? [] : "";
                                                        if (mapToIsArray === "array") {
                                                            if (!Array.isArray(modifyRow[mapTo]))
                                                                modifyRow[mapTo] = [];
                                                            modifyRow[mapTo].push(rowData[pk]);
                                                            modifyRow[mapTo] = modifyRow[mapTo].filter(function (v, i, s) {
                                                                return s.indexOf(v) === i;
                                                            });
                                                            updateRow(modifyRow, function () {
                                                                nextRelation();
                                                            });
                                                        }
                                                        else {
                                                            modifyRow[mapTo] = rowData[pk];
                                                            updateRow(modifyRow, function () {
                                                                nextRelation();
                                                            });
                                                        }
                                                    });
                                                };
                                            }))(nextRow);
                                        });
                                        break;
                                    case "delete":
                                    case "drop":
                                        removeOldRelations(nextRow);
                                        break;
                                }
                            }
                            else {
                                nextRow();
                            }
                        });
                    };
                }))(res);
            });
        });
    };
    return _NanoSQLORMQuery;
}());
exports._NanoSQLORMQuery = _NanoSQLORMQuery;
