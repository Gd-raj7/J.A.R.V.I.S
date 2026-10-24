
from ddgs import DDGS


def search_web(query: str, max_results: int = 5) -> dict:
    """Search the web and return a small set of current results."""

    query = query.strip()

    if not query:
        return {
            "success": False,
            "query": query,
            "results": [],
            "message": "Please provide a search query.",
        }

    # Keep resource usage controlled.
    max_results = max(1, min(max_results, 5))

    try:
        with DDGS() as search:
            results = list(
                search.text(
                    query,
                    max_results=max_results,
                )
            )

        cleaned_results = []

        for item in results:
            cleaned_results.append({
                "title": item.get("title", ""),
                "url": item.get("href", ""),
                "snippet": item.get("body", ""),
            })

        return {
            "success": True,
            "query": query,
            "results": cleaned_results,
            "message": (
                "Search completed."
                if cleaned_results
                else "No results were returned."
            ),
        }

    except Exception as exc:
        return {
            "success": False,
            "query": query,
            "results": [],
            "message": (
                f"Web search failed: {type(exc).__name__}: {exc}"
            ),
        }
