"""
Scraper for FoodsDictionary website
Scrapes pages 1-58 and extracts tbody id values and h1 product names
"""

import requests
from bs4 import BeautifulSoup
import json
import time
import re
from urllib.parse import urljoin, urlparse

def clean_text(text):
    """Clean text by removing extra spaces around punctuation"""
    if not text:
        return text
    # Remove spaces before punctuation marks
    text = re.sub(r'\s+([.,;:!?])', r'\1', text)
    # Remove multiple spaces
    text = re.sub(r'\s+', ' ', text)
    return text.strip()

BASE_URL = "https://www.foodsdictionary.co.il"
SEARCH_URL = "https://www.foodsdictionary.co.il/FoodsSearch.php"
TOTAL_PAGES = 58

def get_page_content(url, retries=3, delay=2):
    """Fetch page content with retry logic"""
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'he,en-US;q=0.7,en;q=0.3',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
    }
    
    for attempt in range(retries):
        try:
            response = requests.get(url, headers=headers, timeout=30)
            # Try to detect encoding, fallback to utf-8
            if response.encoding is None or response.encoding == 'ISO-8859-1':
                response.encoding = response.apparent_encoding or 'utf-8'
            response.raise_for_status()
            return response.text
        except requests.exceptions.RequestException as e:
            print(f"Error fetching {url} (attempt {attempt + 1}/{retries}): {e}")
            if attempt < retries - 1:
                time.sleep(delay * (attempt + 1))
            else:
                return None
    return None

def extract_product_links(html_content, page_num):
    """Extract all product links from a search results page"""
    soup = BeautifulSoup(html_content, 'html.parser')
    product_links = []
    
    # Find all list items with class "media" that contain links
    list_items = soup.find_all('li', class_='media')
    
    for li in list_items:
        # Find all links within each list item - usually there's a main product link
        links = li.find_all('a', href=True)
        
        # Filter out links that are probably not product links (like navigation, etc.)
        for link in links:
            href = link.get('href')
            if href:
                # Skip anchors, javascript links, and mailto links
                if href.startswith('#') or href.startswith('javascript:') or href.startswith('mailto:'):
                    continue
                
                # Skip common non-product links
                skip_patterns = ['/FoodsSearch.php', '/index.php', '#']
                if any(pattern in href for pattern in skip_patterns):
                    continue
                
                # Make absolute URL if it's relative
                full_url = urljoin(BASE_URL, href)
                
                # Avoid duplicates
                if full_url not in product_links:
                    product_links.append(full_url)
                    break  # Take the first valid link per list item
    
    print(f"Page {page_num}: Found {len(product_links)} product links")
    return product_links

def extract_product_data(html_content, product_url):
    """Extract nutritional data (name/value pairs) and h1 product name from a product detail page"""
    soup = BeautifulSoup(html_content, 'html.parser')
    
    product_data = {
        'url': product_url,
        'name': None,
        'nutritional_data': [],
        'ingredients': None,
        'allergens': None,
        'kosher': None
    }
    
    # Extract h1 (product name)
    h1 = soup.find('h1')
    if h1:
        product_data['name'] = h1.get_text(strip=True)
    
    # Extract ingredients - look for h3 with text "רכיבים" (Ingredients)
    ingredients_h3 = soup.find('h3', string=lambda text: text and 'רכיבים' in text)
    if not ingredients_h3:
        # Try finding by text content
        for h3 in soup.find_all('h3'):
            if h3.get_text(strip=True) == 'רכיבים':
                ingredients_h3 = h3
                break
    
    if ingredients_h3:
        # Find the next p tag after the h3 that contains the ingredients
        next_p = ingredients_h3.find_next_sibling('p')
        if next_p:
            # Get all text from the p tag with proper spacing
            ingredients_text = next_p.get_text(separator=' ', strip=True)
            product_data['ingredients'] = clean_text(ingredients_text)
    
    # Extract allergens - look for div with class 'allergic-box'
    allergic_box = soup.find('div', class_='allergic-box')
    if allergic_box:
        # Find the p tag with allergen information (skip the h5 header)
        allergen_p = allergic_box.find('p')
        if allergen_p:
            # Get text from the p tag with proper spacing (contains the actual allergen info)
            allergens_text = allergen_p.get_text(separator=' ', strip=True)
            product_data['allergens'] = clean_text(allergens_text)
        else:
            # Fallback: get all text but try to remove header
            allergens_text = allergic_box.get_text(separator=' ', strip=True)
            # Remove common header text
            headers_to_remove = ['מידע על רכיבים אלרגניים', 'על רכיבים אלרגניים']
            for header in headers_to_remove:
                allergens_text = allergens_text.replace(header, '').strip()
            if allergens_text:
                product_data['allergens'] = clean_text(allergens_text)
    
    # Extract kosher information - look for h3 with text "כשרות" (Kosher)
    kosher_h3 = soup.find('h3', string=lambda text: text and 'כשרות' in text)
    if not kosher_h3:
        # Try finding by text content
        for h3 in soup.find_all('h3'):
            if h3.get_text(strip=True) == 'כשרות':
                kosher_h3 = h3
                break
    
    if kosher_h3:
        # Find the next p tag after the h3 that contains the kosher information
        next_p = kosher_h3.find_next_sibling('p')
        if next_p:
            # Get all text from the p tag with proper spacing
            kosher_text = next_p.get_text(separator=' ', strip=True)
            product_data['kosher'] = clean_text(kosher_text)
    
    # Find the table with nutritional data - look for table with class 'nv-table'
    # This table has rows directly (no tbody)
    nutritional_table = soup.find('table', class_='nv-table')
    
    if nutritional_table:
        # Extract rows directly from table (skip header row)
        rows = nutritional_table.find_all('tr')
        for row in rows:
            cells = row.find_all('td')
            if len(cells) >= 2:
                # In the nutritional table: cell 0 = name, cell 1 = value
                name_cell = cells[0]
                value_cell = cells[1]
                
                # Extract name - get full text from name cell with proper spacing
                name_text = name_cell.get_text(separator=' ', strip=True)
                name_text = clean_text(name_text)
                
                # Extract value - prefer data-start attribute, fallback to text content
                value_text = value_cell.get('data-start', '')
                if not value_text:
                    value_text = value_cell.get_text(strip=True)
                
                # Only add if we have both name and value, and it's not a header row
                if name_text and value_text and name_text.strip() and value_text.strip():
                    # Skip header rows
                    header_texts = ['סימון תזונתי', 'ל-100', 'ל- 100']
                    if not any(ht in name_text for ht in header_texts):
                        nutritional_item = {
                            'name': name_text.strip(),
                            'value': value_text.strip()
                        }
                        product_data['nutritional_data'].append(nutritional_item)
    
    return product_data

def scrape_all_pages(start_page=1, end_page=None, save_progress_callback=None):
    """Main function to scrape all pages"""
    if end_page is None:
        end_page = TOTAL_PAGES
    
    all_products = []
    
    # The search query parameter appears to be URL-encoded Hebrew text
    # Using the same query parameter from the example URL
    query_param = "%E2%E1%E9%F0%E4"  # This is the encoded query from the example
    
    for page_num in range(start_page, end_page + 1):
        print(f"\n{'='*60}")
        print(f"Scraping page {page_num}/{end_page}")
        print(f"{'='*60}")
        
        # Construct search URL
        search_url = f"{SEARCH_URL}?q={query_param}&page={page_num}"
        print(f"Fetching: {search_url}")
        
        # Get search results page
        html_content = get_page_content(search_url)
        if not html_content:
            print(f"Failed to fetch page {page_num}, skipping...")
            continue
        
        # Extract product links from this page
        product_links = extract_product_links(html_content, page_num)
        
        if not product_links:
            print(f"No product links found on page {page_num}")
            continue
        
        # Scrape each product detail page
        for i, product_url in enumerate(product_links, 1):
            print(f"  [{i}/{len(product_links)}] Fetching: {product_url[:80]}...")
            
            product_html = get_page_content(product_url)
            if not product_html:
                print(f"    Failed to fetch product page, skipping...")
                continue
            
            # Extract product data
            product_data = extract_product_data(product_html, product_url)
            
            if product_data['name'] or product_data['nutritional_data']:
                all_products.append(product_data)
                print(f"    [OK] {product_data['name']} | Nutritional items: {len(product_data['nutritional_data'])}")
            else:
                print(f"    [WARNING] No data extracted from product page")
            
            # Be respectful - add a small delay between requests
            time.sleep(1)
        
        # Save progress after each page
        if save_progress_callback:
            save_progress_callback(all_products)
        
        # Add a longer delay between pages
        if page_num < end_page:
            print(f"Waiting 2 seconds before next page...")
            time.sleep(2)
    
    return all_products

def save_to_json(data, filename='foodsdictionary_products.json'):
    """Save scraped data to JSON file"""
    with open(filename, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"\n[OK] Data saved to {filename}")


def save_progress(data, filename='foodsdictionary_products_progress.json'):
    """Save progress periodically"""
    with open(filename, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

def load_progress(filename='foodsdictionary_products_progress.json'):
    """Load previous progress if exists"""
    try:
        with open(filename, 'r', encoding='utf-8') as f:
            return json.load(f)
    except FileNotFoundError:
        return []
    except Exception as e:
        print(f"Error loading progress: {e}")
        return []

if __name__ == "__main__":
    import sys
    
    # Check for test mode (test a single page) or single page mode
    test_mode = '--test' in sys.argv or '-t' in sys.argv
    single_page = '--page' in sys.argv or any(arg.startswith('--pages=') for arg in sys.argv)
    
    print("Starting FoodsDictionary scraper...")
    if test_mode:
        print("TEST MODE: Will only scrape page 1, first product")
        end_page = 1
    elif single_page:
        # Extract page number if provided (e.g., --pages=1)
        page_arg = next((arg for arg in sys.argv if arg.startswith('--pages=')), None)
        if page_arg:
            end_page = int(page_arg.split('=')[1])
        else:
            end_page = 1
        print(f"Will scrape only page {end_page}")
    else:
        # Default to page 1 only as requested
        print("Will scrape only page 1")
        end_page = 1
    
    all_products = []
    
    try:
        if test_mode:
            # Test mode: just scrape first product from page 1
            query_param = "%E2%E1%E9%F0%E4"
            search_url = f"{SEARCH_URL}?q={query_param}&page=1"
            print(f"\nFetching test page: {search_url}")
            
            html_content = get_page_content(search_url)
            if html_content:
                product_links = extract_product_links(html_content, 1)
                print(f"\nFound {len(product_links)} product links")
                
                # Test scraping first product only
                if product_links:
                    test_url = product_links[0]
                    print(f"\nTesting with first product: {test_url}")
                    product_html = get_page_content(test_url)
                    if product_html:
                        product_data = extract_product_data(product_html, test_url)
                        all_products.append(product_data)
                        print(f"\n[OK] Test successful!")
                        print(f"  Product Name: {product_data['name']}")
                        print(f"  Nutritional items: {len(product_data['nutritional_data'])}")
        else:
            # Full scrape - save progress after each page
            all_products = scrape_all_pages(start_page=1, end_page=end_page,
                                          save_progress_callback=save_progress)
        
        print(f"\n{'='*60}")
        print(f"Scraping completed!")
        print(f"Total products scraped: {len(all_products)}")
        print(f"{'='*60}")
        
        if all_products:
            # Save final results (JSON only)
            save_to_json(all_products, 'foodsdictionary_products.json')
            
            # Print summary
            products_with_names = sum(1 for p in all_products if p['name'])
            products_with_nutritional_data = sum(1 for p in all_products if p['nutritional_data'])
            total_nutritional_items = sum(len(p['nutritional_data']) for p in all_products)
            
            print(f"\nSummary:")
            print(f"  Products with names: {products_with_names}")
            print(f"  Products with nutritional data: {products_with_nutritional_data}")
            print(f"  Total nutritional items found: {total_nutritional_items}")
        else:
            print("\n[WARNING] No products were scraped. Please check the scraper logic.")
    
    except KeyboardInterrupt:
        print("\n\nScraping interrupted by user.")
        if all_products:
            print(f"Saving {len(all_products)} products to progress file...")
            save_progress(all_products)
            print("Progress saved! You can resume later.")
    except Exception as e:
        print(f"\n\nError during scraping: {e}")
        import traceback
        traceback.print_exc()
        if all_products:
            print(f"\nSaving {len(all_products)} products to progress file...")
            save_progress(all_products)

