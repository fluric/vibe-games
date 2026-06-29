import torch
from games.connect_four.train import estimate_elo_vs_random
from games.connect_four.net import create_net

device = torch.device('mps')
net = create_net(device)
print("Starting on MPS...")
elo = estimate_elo_vs_random(net, device, num_games=2, num_simulations=10)
print("Done:", elo)
