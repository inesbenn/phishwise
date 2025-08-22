//src/controllers/targetController.js
const mongoose = require('mongoose');
const { validationResult } = require('express-validator');
const Campaign = require('../models/Campaign'); // Importez le modèle Campaign

// PUT /api/campaigns/:id/step/1 - Met à jour la liste des cibles d'une campagne
exports.updateStep1 = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    console.error("ERREUR DE VALIDATION (updateStep1):", errors.array());
    return res.status(400).json({ errors: errors.array() });
  }

  const { targets } = req.body;
  const { id } = req.params; // L'ID de la campagne

  try {
    const campaign = await Campaign.findByIdAndUpdate(
      id,
      { targets }, // Met à jour le tableau 'targets' de la campagne
      { new: true, runValidators: true } // Retourne le document mis à jour et exécute les validateurs de schéma
    );
    if (!campaign) {
      return res.status(404).json({ message: 'Campagne non trouvée pour la mise à jour des cibles' });
    }
    console.log("SUCCÈS (updateStep1): Cibles de la campagne mises à jour. ID Campagne:", campaign._id);
    res.json(campaign);
  } catch (err) {
    console.error("ERREUR (updateStep1): Erreur lors de la mise à jour des cibles de la campagne :", err);
    res.status(500).json({ message: err.message });
  }
};

// GET /api/campaigns/:id/targets - Récupère toutes les cibles d'une campagne
exports.getTargets = async (req, res) => {
  const { id } = req.params; // L'ID de la campagne

  try {
    const campaign = await Campaign.findById(id);
    if (!campaign) {
      return res.status(404).json({ message: 'Campagne non trouvée pour la récupération des cibles' });
    }
    console.log("SUCCÈS (getTargets): Cibles récupérées pour la campagne. ID Campagne:", campaign._id);
    res.json(campaign.targets); // Retourne le tableau des cibles
  } catch (err) {
    console.error("ERREUR (getTargets): Erreur lors de la récupération des cibles de la campagne :", err);
    res.status(500).json({ message: err.message });
  }
};

// PUT /api/campaigns/:id/targets/:targetId - Met à jour une cible spécifique dans une campagne
/*exports.updateTarget = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    console.error("ERREUR DE VALIDATION (updateTarget):", errors.array());
    return res.status(400).json({ errors: errors.array() });
  }

  const { id, targetId } = req.params; // ID de la campagne et ID de la cible
  const { firstName, lastName, email, position, country, office } = req.body;

  try {
    const campaign = await Campaign.findOneAndUpdate(
      { _id: id, 'targets._id': targetId }, // Trouver la campagne et la cible imbriquée
      {
        $set: { // Utiliser $set pour mettre à jour les champs de la cible spécifique
          'targets.$.firstName': firstName,
          'targets.$.lastName':  lastName,
          'targets.$.email':     email,
          'targets.$.position':  position,
          'targets.$.country':   country,
          'targets.$.office':    office
        }
      },
      { new: true, runValidators: true } // Retourne le document mis à jour et exécute les validateurs de schéma
    );
    if (!campaign) {
      return res.status(404).json({ message: 'Cible non trouvée dans cette campagne' });
    }
    const updatedTarget = campaign.targets.id(targetId); // Récupère la cible mise à jour depuis le document retourné
    console.log("SUCCÈS (updateTarget): Cible mise à jour. ID Cible:", updatedTarget._id);
    res.json(updatedTarget);
  } catch (err) {
    console.error("ERREUR (updateTarget): Erreur lors de la mise à jour de la cible :", err);
    res.status(500).json({ message: err.message });
  }
};

// DELETE /api/campaigns/:id/targets/:targetId - Supprime une cible spécifique d'une campagne
exports.deleteTarget = async (req, res) => {
    try {
        const { id: campaignId, targetId } = req.params; // 'id' est le param de la campagne, 'targetId' celui de la cible

        // Utiliser findByIdAndUpdate avec $pull pour retirer la cible du tableau 'targets'
        // $pull est un opérateur de mise à jour de MongoDB qui supprime toutes les instances d'une valeur ou toutes les correspondances d'une condition d'un tableau.
        // Ici, nous supprimons le sous-document dont l'_id correspond à targetId.
        const updatedCampaign = await Campaign.findByIdAndUpdate(
            campaignId, // L'ID de la campagne à trouver
            { $pull: { targets: { _id: targetId } } }, // L'opération $pull pour retirer le sous-document cible
            { new: true } // Option pour retourner le document mis à jour (après la modification)
        );

        if (!updatedCampaign) {
            // Si la campagne n'est pas trouvée du tout
            return res.status(404).json({ message: 'Campagne non trouvée.' });
        }

        // Vérifier si la cible a réellement été supprimée du tableau
        // Une manière plus simple et plus directe est de vérifier si l'ID de la cible est toujours présent.
        const targetStillExists = updatedCampaign.targets.some(target => target._id.toString() === targetId);
        
        if (!targetStillExists) {
            // Si la cible n'est plus dans le tableau, c'est que la suppression a réussi.
            console.log("SUCCÈS (deleteTarget): Cible supprimée. ID Cible:", targetId);
            res.status(200).json({ message: 'Cible supprimée avec succès !' });
        } else {
            // Cela peut arriver si le targetId n'existait pas dans le tableau de cibles à l'origine.
            console.log("AVERTISSEMENT (deleteTarget): Cible non trouvée dans la campagne ou déjà supprimée.", targetId);
            res.status(404).json({ message: 'Cible non trouvée dans la campagne ou déjà supprimée.' });
        }

    } catch (error) {
        console.error("ERREUR (deleteTarget): Erreur interne du serveur lors de la suppression de la cible:", error);
        // Envoyer le message d'erreur pour un débogage plus facile
        res.status(500).json({ message: 'Erreur interne du serveur lors de la suppression de la cible.', error: error.message });
    }
};*/
