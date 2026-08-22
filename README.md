# Saint Seville

SaintSeville.org: grounded, citing search over approved Catholic documents on artificial intelligence.

Static site. The Ask box searches a prebuilt index of 958 numbered passages from four approved documents (Antiqua et Nova, Magnifica Humanitas, the Compendium of the Social Doctrine, and the Rome Call for AI Ethics) entirely in the browser. Every result is a short verbatim excerpt with its official paragraph citation, linked to the full text at vatican.va. Nothing is generated; questions the corpus cannot answer are refused.

Excerpts from Vatican documents (c) Libreria Editrice Vaticana, quoted briefly with attribution. Full texts at vatican.va.

The index is exported from the private RAG database (rag/build_db.py in the project folder); rebuild index.json there and commit to update the corpus.
