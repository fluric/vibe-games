import sys
from pathlib import Path
PROJECT_ROOT = Path(__file__).parent.parent.parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from pettingzoo.test import api_test
from rl.games.grail_quest.env_pz import env

def main():
    print("Initializing environment...")
    e = env()
    
    print("Running PettingZoo API test...")
    api_test(e, num_cycles=1000, verbose_progress=True)
    print("API test passed successfully!")

if __name__ == "__main__":
    main()
