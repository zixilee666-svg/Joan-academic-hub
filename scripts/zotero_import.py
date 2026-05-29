#!/usr/bin/env python3
"""
Zotero → Academic Hub 全量导入脚本 (优化版)

策略:
1. 分页拉取所有 items (含 papers + notes + attachments)
2. 利用 parentItem 字段直接匹配 notes → papers (无需逐篇API调用)
3. 拉取 collections 及其成员关系
4. 通过 Academic Hub API 批量导入

用法:
  python zotero_import.py          # 完整导入
  python zotero_import.py --fetch-only  # 仅拉取数据到 JSON
  python zotero_import.py --import-only  # 仅从 JSON 导入 (需先 --fetch-only)
"""
import json
import os
import sys
import time
import urllib.request
import urllib.error

# ============================================================
# 配置
# ============================================================
ZOTERO_API_KEY = "rFor1VFGio6njghSt2M3bOCX"
ZOTERO_USER_ID = "20335119"
ZOTERO_BASE = f"https://api.zotero.org/users/{ZOTERO_USER_ID}"

# Academic Hub API (部署地址)
HUB_BASE = "https://academic-hub-v6-3sutpo9l.edgeone.cool/api"
HUB_USERNAME = "admin"
HUB_PASSWORD = "123456"

ZOTERO_HEADERS = {
    "Zotero-API-Key": ZOTERO_API_KEY,
    "Accept": "application/json",
}

OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "zotero_export")
EXPORT_PATH = os.path.join(OUT_DIR, "zotero_full_export.json")
os.makedirs(OUT_DIR, exist_ok=True)

# ============================================================
# Zotero 数据拉取
# ============================================================

def fetch_json(url, desc="", max_retries=3):
    for attempt in range(max_retries):
        try:
            req = urllib.request.Request(url, headers=ZOTERO_HEADERS)
            with urllib.request.urlopen(req, timeout=30) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except Exception as e:
            if attempt == max_retries - 1:
                print(f"  ❌ [{desc}] 失败: {e}")
                return None
            time.sleep(1.5)
    return None


def fetch_all_items():
    """分页拉取所有 Zotero items (高效)"""
    limit = 100
    start = 0
    all_items = []
    
    while True:
        url = f"{ZOTERO_BASE}/items?format=json&limit={limit}&start={start}"
        batch = fetch_json(url, f"items {start}")
        if not batch:
            break
        
        all_items.extend(batch)
        print(f"  📦 items {start}-{start+len(batch)-1}: {len(batch)} 条 (累计 {len(all_items)})")
        
        if len(batch) < limit:
            break
        start += limit
        time.sleep(0.25)
    
    return all_items


def fetch_collections():
    """拉取所有 collections"""
    return fetch_json(f"{ZOTERO_BASE}/collections?format=json&limit=100", "collections") or []


def fetch_collection_items(col_key):
    """拉取某个 collection 的成员"""
    return fetch_json(f"{ZOTERO_BASE}/collections/{col_key}/items?format=json&limit=200", f"col {col_key}") or []


def process_zotero_data(all_items, collections_raw):
    """处理 Zotero 原始数据 → 结构化导出格式"""
    
    # --- 1. 分类 items ---
    PAPER_TYPES = {"journalArticle", "conferencePaper", "bookSection", "report", "thesis", "preprint"}
    
    papers = []      # (item_data_dict, item_key)
    notes_all = []   # (item_data_dict, item_key, parentItem)
    attachments = [] # (item_data_dict, item_key, parentItem)
    
    for item in all_items:
        data = item.get("data", item)
        item_type = data.get("itemType", "")
        item_key = data.get("key", item.get("key", ""))
        parent = data.get("parentItem", "")
        
        if item_type in PAPER_TYPES:
            papers.append((data, item_key))
        elif item_type == "note":
            notes_all.append((data, item_key, parent))
        elif item_type == "attachment":
            attachments.append((data, item_key, parent))
    
    print(f"\n  📊 分类: {len(papers)} 论文 | {len(notes_all)} 笔记 | {len(attachments)} 附件")
    
    # --- 2. 构建 notes 映射 (高效: O(n) 而非逐篇API调用) ---
    paper_notes = {}  # paper_key → [note_data, ...]
    orphan_notes = []  # 无父级的笔记
    
    for note_data, note_key, parent_key in notes_all:
        if parent_key:
            if parent_key not in paper_notes:
                paper_notes[parent_key] = []
            paper_notes[parent_key].append(note_data)
        else:
            orphan_notes.append(note_data)
    
    total_matched = sum(len(v) for v in paper_notes.values())
    print(f"  📝 笔记匹配: {total_matched} 条 ({len(paper_notes)} 篇论文) | 孤儿笔记: {len(orphan_notes)}")
    
    # --- 3. 处理 collections 成员 ---
    paper_collections = {}  # paper_key → [collection_name, ...]
    collection_info = {}
    
    for col in collections_raw:
        col_key = col.get("key", "")
        col_name = col.get("data", {}).get("name", col_key)
        members = fetch_collection_items(col_key)
        member_keys = [m.get("key", m.get("data", {}).get("key", "")) for m in members]
        collection_info[col_key] = {
            "key": col_key,
            "name": col_name,
            "count": len(member_keys),
        }
        for mk in member_keys:
            if mk not in paper_collections:
                paper_collections[mk] = []
            paper_collections[mk].append(col_name)
        print(f"  📂 {col_name}: {len(member_keys)} 篇")
    
    # --- 4. 构建导出数据 ---
    export = {
        "meta": {
            "total_papers": len(papers),
            "total_notes": len(notes_all),
            "total_attachments": len(attachments),
            "matched_notes": total_matched,
            "collections": len(collection_info),
            "exported_at": time.strftime("%Y-%m-%dT%H:%M:%S"),
        },
        "collections": {k: {"name": v["name"], "count": v["count"]} for k, v in collection_info.items()},
        "papers": [],
    }
    
    for data, key in papers:
        paper_entry = {
            "zotero_key": key,
            "title": data.get("title", "未命名"),
            "authors": [],
            "year": None,
            "venue": data.get("publicationTitle") or data.get("publisher") or "",
            "abstract": data.get("abstractNote", ""),
            "doi": data.get("DOI", ""),
            "url": data.get("url", ""),
            "tags": [t.get("tag", "") for t in data.get("tags", [])],
            "item_type": data.get("itemType"),
            "date": data.get("date", ""),
            "date_added": data.get("dateAdded", ""),
            "collections": paper_collections.get(key, []),
            "notes": paper_notes.get(key, []),
            "note_count": len(paper_notes.get(key, [])),
        }
        
        # 解析作者
        creators = data.get("creators", [])
        for c in creators:
            if c.get("creatorType") == "author":
                if c.get("firstName") and c.get("lastName"):
                    paper_entry["authors"].append(f"{c['firstName']} {c['lastName']}")
                elif c.get("name"):
                    paper_entry["authors"].append(c["name"])
        
        # 解析年份
        date_str = data.get("date", "")
        import re
        year_match = re.search(r"(\d{4})", date_str)
        if year_match:
            paper_entry["year"] = int(year_match.group(1))
        
        export["papers"].append(paper_entry)
    
    return export


def fetch_all():
    """完整拉取"""
    print("=" * 60)
    print("🔍 Zotero → Academic Hub 数据拉取")
    print("=" * 60)
    
    print("\n[1/3] 拉取所有条目...")
    all_items = fetch_all_items()
    
    print("\n[2/3] 拉取分类集合...")
    collections = fetch_collections()
    
    print("\n[3/3] 处理数据...")
    export = process_zotero_data(all_items, collections)
    
    # 保存
    with open(EXPORT_PATH, "w", encoding="utf-8") as f:
        json.dump(export, f, ensure_ascii=False, indent=2)
    
    print(f"\n✅ 数据已保存: {EXPORT_PATH}")
    print(f"   论文: {export['meta']['total_papers']} 篇")
    print(f"   笔记: {export['meta']['total_notes']} 条")
    print(f"   分类: {export['meta']['collections']} 个")
    return export


# ============================================================
# Academic Hub API 导入
# ============================================================

def hub_request(method, path, token=None, body=None):
    """调用 Academic Hub API"""
    url = f"{HUB_BASE}{path}"
    headers = {
        "Content-Type": "application/json",
        "Accept": "application/json",
    }
    if token:
        headers["Authorization"] = f"Bearer {token}"
    
    try:
        data = json.dumps(body).encode("utf-8") if body else None
        req = urllib.request.Request(url, data=data, headers=headers, method=method)
        with urllib.request.urlopen(req, timeout=60) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        err_body = e.read().decode("utf-8")[:500]
        return {"success": False, "error": f"HTTP {e.code}: {err_body}"}
    except Exception as e:
        return {"success": False, "error": str(e)}


def hub_login():
    """登录获取 JWT token"""
    print("\n🔑 登录 Academic Hub...")
    resp = hub_request("POST", "/auth/login", body={
        "username": HUB_USERNAME,
        "password": HUB_PASSWORD,
    })
    if resp.get("success") and resp.get("data", {}).get("token"):
        token = resp["data"]["token"]
        print(f"  ✅ 登录成功 (token: {token[:20]}...)")
        return token
    else:
        print(f"  ❌ 登录失败: {resp}")
        return None


def import_papers(export_data, token):
    """通过 API 批量导入论文"""
    papers = export_data["papers"]
    total = len(papers)
    imported = 0
    failed = 0
    errors = []
    
    # 先尝试通过 Zotero 专用端点导入
    print(f"\n📥 方式1: 通过 /api/import/zotero 导入...")
    resp = hub_request("POST", "/import/zotero", token=token, body={
        "userId": ZOTERO_USER_ID,
        "apiKey": ZOTERO_API_KEY,
        "importNotes": True,
        "importAttachments": False,
    })
    
    if resp.get("success"):
        stats = resp.get("data", {}).get("stats", {})
        print(f"  ✅ Zotero 端点成功: {stats.get('papers', 0)} papers, {stats.get('notes', 0)} notes")
        return resp["data"]
    
    print(f"  ⚠️ Zotero 端点失败: {resp.get('error', 'unknown')}")
    print(f"  回退到逐篇导入模式...")
    
    # 回退：逐篇导入
    for i, paper in enumerate(papers):
        try:
            # 构建 Paper 对象
            paper_obj = {
                "title": paper["title"],
                "authors": paper["authors"],
                "year": paper["year"] or 2024,
                "venue": paper["venue"] or "Unknown",
                "abstract": paper["abstract"][:2000] if paper["abstract"] else "",
                "doi": paper["doi"],
                "url": paper["url"],
                "tags": paper["tags"][:10],
                "notes": [{
                    "id": f"zn-{j}",
                    "content": n.get("note", "")[:5000],
                    "createdAt": n.get("dateAdded", time.strftime("%Y-%m-%dT%H:%M:%S")),
                } for j, n in enumerate(paper.get("notes", [])[:5])],
                "zoteroKey": paper["zotero_key"],
                "zoteroCollections": paper.get("collections", []),
            }
            
            resp = hub_request("POST", "/papers", token=token, body=paper_obj)
            if resp.get("success"):
                imported += 1
            else:
                failed += 1
                errors.append(f"{paper['title'][:40]}: {resp.get('error', 'unknown')}")
            
            if (i + 1) % 20 == 0:
                print(f"  进度: {i+1}/{total} (成功 {imported}, 失败 {failed})")
            
            time.sleep(0.1)  # 避免速率限制
        except Exception as e:
            failed += 1
            errors.append(f"{paper['title'][:40]}: {str(e)}")
    
    print(f"\n  ✅ 导入完成: {imported} 成功, {failed} 失败")
    if errors:
        print(f"  错误 ({len(errors)}):")
        for err in errors[:10]:
            print(f"    - {err}")
    
    return {"papers": papers[:imported], "stats": {"papers": imported, "errors": failed}}


def create_libraries(export_data, token, imported_papers):
    """根据 Zotero collections 创建 Academic Hub Libraries 并关联论文"""
    collections = export_data.get("collections", {})
    papers = export_data.get("papers", [])
    
    if not collections:
        print("\n  ℹ️ 无分类信息，跳过 Library 创建")
        return
    
    print(f"\n📚 创建文献库 (Libraries)...")
    
    # 预定义 icon 和 color 映射
    LIB_THEMES = {
        "Cross_GNN_Fraud": {"color": "#ef4444", "icon": "Network", "description": "跨领域GNN在欺诈检测中的应用"},
        "Fraud_Core": {"color": "#f59e0b", "icon": "Shield", "description": "金融欺诈检测核心文献"},
        "GNN_Core": {"color": "#3b82f6", "icon": "GitBranch", "description": "图神经网络核心理论与方法"},
    }
    
    created_libs = {}
    for col_key, col_data in collections.items():
        col_name = col_data["name"]
        theme = LIB_THEMES.get(col_name, {"color": "#6b7280", "icon": "BookOpen", "description": ""})
        
        # 创建 Library
        lib_body = {
            "name": col_name,
            "description": theme["description"],
            "color": theme["color"],
            "icon": theme["icon"],
            "paperIds": [],
        }
        
        resp = hub_request("POST", "/libraries", token=token, body=lib_body)
        if resp.get("success"):
            lib_id = resp.get("data", {}).get("id", "")
            created_libs[col_name] = lib_id
            print(f"  ✅ {col_name} → Library ID: {lib_id}")
        else:
            print(f"  ❌ {col_name} 创建失败: {resp.get('error', 'unknown')}")
    
    # 关联论文到 Library
    if created_libs:
        print(f"\n🔗 关联论文到文献库...")
        linked = 0
        for paper in papers:
            paper_cols = paper.get("collections", [])
            zotero_key = paper.get("zotero_key", "")
            
            # 在导入的论文中查找对应的 ID
            for imported in imported_papers.get("papers", []):
                if isinstance(imported, dict) and imported.get("zoteroKey") == zotero_key:
                    paper_id = imported.get("id", "")
                    if paper_id:
                        for pc in paper_cols:
                            lib_id = created_libs.get(pc)
                            if lib_id:
                                # 更新 paper 的 libraryId
                                hub_request("PUT", f"/papers/{paper_id}", token=token, body={
                                    "libraryId": lib_id,
                                })
                                linked += 1
                    break
        
        print(f"  ✅ {linked} 个关联已创建")


# ============================================================
# 主流程
# ============================================================

def main():
    mode = sys.argv[1] if len(sys.argv) > 1 else ""
    
    if mode == "--fetch-only":
        fetch_all()
        return
    
    # 检查是否已有导出数据
    if not os.path.exists(EXPORT_PATH):
        print("📦 未找到导出数据，先拉取...")
        export_data = fetch_all()
    else:
        print(f"📦 加载已有导出数据: {EXPORT_PATH}")
        with open(EXPORT_PATH, "r", encoding="utf-8") as f:
            export_data = json.load(f)
        print(f"   论文: {export_data['meta']['total_papers']} 篇")
    
    if mode == "--import-only":
        pass  # 仅导入，跳过拉取
    elif mode == "--fetch-only":
        return  # 已完成
    
    # 登录
    token = hub_login()
    if not token:
        print("❌ 无法登录 Academic Hub，请检查 API 是否在线")
        sys.exit(1)
    
    # 导入论文
    result = import_papers(export_data, token)
    
    # 创建 Libraries
    create_libraries(export_data, token, result)
    
    print(f"\n{'='*60}")
    print("🎉 Zotero → Academic Hub 导入完成！")
    print(f"{'='*60}")


if __name__ == "__main__":
    main()
