#!/usr/bin/env python3
"""
Zotero 全量数据拉取脚本
- 分页拉取所有 items (172条)
- 拉取 collections 及其成员关系
- 拉取 notes 子项
- 导出为 JSON 供后续导入使用
"""
import json
import os
import sys
import urllib.request
import urllib.parse
import time

API_KEY = "rFor1VFGio6njghSt2M3bOCX"
USER_ID = "20335119"
BASE = f"https://api.zotero.org/users/{USER_ID}"

HEADERS = {
    "Zotero-API-Key": API_KEY,
    "Accept": "application/json",
}

OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "zotero_export")
os.makedirs(OUT_DIR, exist_ok=True)


def fetch_json(url, description=""):
    """带重试的 JSON 请求"""
    for attempt in range(3):
        try:
            req = urllib.request.Request(url, headers=HEADERS)
            with urllib.request.urlopen(req, timeout=30) as resp:
                data = json.loads(resp.read().decode("utf-8"))
            return data
        except Exception as e:
            print(f"  [{description}] 第{attempt+1}次失败: {e}")
            if attempt < 2:
                time.sleep(2)
    return None


def fetch_all_items():
    """分页拉取所有 items"""
    limit = 100
    start = 0
    all_items = []
    
    # 先获取总数
    url = f"{BASE}/items?format=json&limit=1"
    first = fetch_json(url, "first page")
    if not first:
        print("ERROR: 无法连接 Zotero API")
        return []
    
    # Zotero API v3 returns headers with total count
    # Try to get from response
    total = 172  # 已知
    
    while True:
        url = f"{BASE}/items?format=json&limit={limit}&start={start}"
        print(f"  Fetching items {start}-{start+limit}...")
        batch = fetch_json(url, f"items {start}")
        if not batch:
            break
        
        all_items.extend(batch)
        print(f"    获取 {len(batch)} 条, 累计 {len(all_items)} 条")
        
        if len(batch) < limit:
            break
        start += limit
        time.sleep(0.3)  # 礼貌延迟
    
    return all_items


def fetch_collections():
    """拉取所有 collections"""
    url = f"{BASE}/collections?format=json&limit=100"
    return fetch_json(url, "collections") or []


def fetch_collection_items(collection_key):
    """拉取某个 collection 中的 items"""
    url = f"{BASE}/collections/{collection_key}/items?format=json&limit=100"
    return fetch_json(url, f"collection {collection_key}") or []


def fetch_children(parent_key):
    """拉取某个 item 的子项（notes/attachments）"""
    url = f"{BASE}/items/{parent_key}/children?format=json&limit=100"
    return fetch_json(url, f"children of {parent_key}") or []


def main():
    print("=" * 60)
    print("Zotero 全量数据拉取")
    print("=" * 60)
    
    # 1. 拉取所有 items
    print("\n[1/4] 拉取所有文献条目...")
    all_items = fetch_all_items()
    print(f"  总计: {len(all_items)} 条")
    
    # 分类统计
    papers = [i for i in all_items if i.get("data", {}).get("itemType") in 
              ("journalArticle", "conferencePaper", "bookSection", "report", "thesis", "preprint")]
    notes_raw = [i for i in all_items if i.get("data", {}).get("itemType") == "note"]
    attachments = [i for i in all_items if i.get("data", {}).get("itemType") == "attachment"]
    
    print(f"  论文: {len(papers)}, 笔记: {len(notes_raw)}, 附件: {len(attachments)}")
    
    # 2. 拉取 collections
    print("\n[2/4] 拉取分类集合...")
    collections = fetch_collections()
    print(f"  总计: {len(collections)} 个分类")
    
    # 为每个 collection 获取成员
    collection_items = {}
    for col in collections:
        col_key = col.get("key", "")
        col_name = col.get("data", {}).get("name", col_key)
        items_in_col = fetch_collection_items(col_key)
        item_keys = [i.get("key", i.get("data", {}).get("key", "")) for i in items_in_col]
        collection_items[col_key] = {
            "name": col_name,
            "key": col_key,
            "item_count": len(item_keys),
            "item_keys": item_keys,
        }
        print(f"  {col_name}: {len(item_keys)} 篇")
    
    # 3. 拉取 notes (子项)
    print("\n[3/4] 拉取文献笔记...")
    paper_notes_map = {}
    for paper in papers:
        paper_key = paper.get("key", paper.get("data", {}).get("key", ""))
        children = fetch_children(paper_key)
        notes_for_paper = [c for c in children if c.get("data", {}).get("itemType") == "note"]
        if notes_for_paper:
            paper_notes_map[paper_key] = notes_for_paper
    
    total_notes = sum(len(v) for v in paper_notes_map.values())
    print(f"  {len(paper_notes_map)} 篇论文有笔记, 共 {total_notes} 条笔记")
    
    # 4. 保存导出
    print("\n[4/4] 保存导出文件...")
    
    # 构建论文→collection 映射
    paper_to_collections = {}
    for col_key, col_data in collection_items.items():
        for item_key in col_data["item_keys"]:
            if item_key not in paper_to_collections:
                paper_to_collections[item_key] = []
            paper_to_collections[item_key].append(col_key)
    
    # 构建完整导出数据
    export_data = {
        "meta": {
            "total_items": len(all_items),
            "total_papers": len(papers),
            "total_notes": len(notes_raw),
            "total_attachments": len(attachments),
            "collections_count": len(collections),
            "matched_notes": total_notes,
        },
        "collections": {k: v for k, v in collection_items.items()},
        "paper_to_collections": paper_to_collections,
        "papers": [p.get("data", p) for p in papers],
        "paper_notes_map": {k: [n.get("data", n) for n in v] for k, v in paper_notes_map.items()},
    }
    
    # 写入 JSON
    out_path = os.path.join(OUT_DIR, "zotero_full_export.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(export_data, f, ensure_ascii=False, indent=2)
    print(f"  完整导出: {out_path}")
    
    # 写入精简摘要
    summary = {
        "collections": {k: {"name": v["name"], "count": v["item_count"]} for k, v in collection_items.items()},
        "paper_sample": [
            {
                "key": p.get("key", p.get("data", {}).get("key", "")),
                "title": (p.get("title") or p.get("data", {}).get("title", ""))[:80],
                "year": (p.get("date") or p.get("data", {}).get("date", ""))[:4],
                "collections": paper_to_collections.get(p.get("key", p.get("data", {}).get("key", "")), []),
                "has_notes": p.get("key", p.get("data", {}).get("key", "")) in paper_notes_map,
            }
            for p in papers[:20]
        ],
    }
    summary_path = os.path.join(OUT_DIR, "zotero_summary.json")
    with open(summary_path, "w", encoding="utf-8") as f:
        json.dump(summary, f, ensure_ascii=False, indent=2)
    print(f"  摘要预览: {summary_path}")
    
    print(f"\n{'='*60}")
    print("✅ 数据拉取完成!")
    print(f"  论文: {len(papers)} 篇")
    print(f"  笔记: {total_notes} 条")
    print(f"  分类: {len(collections)} 个")
    print(f"  导出文件: {OUT_DIR}")
    print(f"{'='*60}")


if __name__ == "__main__":
    main()
